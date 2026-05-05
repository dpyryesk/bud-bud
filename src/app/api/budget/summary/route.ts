import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  scaleBudgetAmount,
  getCompletePeriodsBetween,
  type BudgetPeriodType,
} from '@/lib/date-utils';
import type { Budget } from '@/generated/prisma/client';
import { collectDescendantTagIds } from '@/lib/tag-tree';

/**
 * Return the latest budget whose startDate <= date.
 * Falls back to the earliest budget if none qualifies (date is before all budgets).
 * Assumes budgets is sorted by startDate asc.
 */
function findApplicableBudget(budgets: Budget[], date: Date): Budget {
  let applicable: Budget | null = null;
  for (const budget of budgets) {
    if (budget.startDate <= date) {
      applicable = budget;
    }
  }
  return applicable ?? budgets[0];
}

/**
 * Walk backwards through the budget chain to find the date from which rollover
 * history should accumulate.
 *
 * - If the given budget has resetRollover = true, rollover resets here →
 *   history starts at budget.startDate.
 * - Otherwise, find the previous budget (highest startDate < budget.startDate)
 *   and recurse.
 * - If there is no previous budget, history starts at the first budget's startDate.
 *
 * Assumes allBudgets is sorted by startDate asc.
 */
function findRolloverHistoryStart(budget: Budget, allBudgets: Budget[]): Date {
  if (budget.resetRollover) {
    return budget.startDate;
  }

  // Find the immediately preceding budget
  const previousBudget = [...allBudgets].reverse().find((b) => b.startDate < budget.startDate);

  if (!previousBudget) {
    // No earlier budget — start from this budget's own startDate
    return budget.startDate;
  }

  return findRolloverHistoryStart(previousBudget, allBudgets);
}

// GET /api/budget/summary - Computed budget vs actual for period
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  // Both params are expected as date-only strings (YYYY-MM-DD), parsed as UTC midnight.
  // Extend the end date to UTC end-of-day so the transaction filter covers the full last day.
  const startDate = new Date(start);
  const endDateMidnight = new Date(end);
  const endDate = new Date(
    Date.UTC(
      endDateMidnight.getUTCFullYear(),
      endDateMidnight.getUTCMonth(),
      endDateMidnight.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  const viewPeriod = {
    start: startDate,
    end: endDate,
    label: '',
    type: 'custom' as const,
  };

  // Load all budgets first so we can resolve which one applies to this view period
  const allBudgets = await prisma.budget.findMany({
    orderBy: { startDate: 'asc' },
  });

  if (allBudgets.length === 0) {
    return NextResponse.json({ error: 'No budgets found' }, { status: 404 });
  }

  const applicableBudget = findApplicableBudget(allBudgets, viewPeriod.start);

  // Load all data in parallel upfront - no N+1 in the loops below
  const [budgetLines, allTags, categories] = await Promise.all([
    prisma.budgetLine.findMany({
      where: { budgetId: applicableBudget.id },
      include: {
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, isSource: true } },
          },
        },
      },
      orderBy: [{ categoryId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    }),
    // Load all tags so we can build a complete children map in memory
    prisma.tag.findMany({ select: { id: true, parentId: true } }),
    prisma.budgetCategory.findMany({
      where: { budgetId: applicableBudget.id },
      orderBy: { order: 'asc' },
    }),
  ]);

  // Build a parent→children map from the full tag list (no per-tag DB calls)
  const childrenMap = new Map<string, string[]>();
  for (const tag of allTags) {
    if (tag.parentId) {
      const existing = childrenMap.get(tag.parentId) ?? [];
      existing.push(tag.id);
      childrenMap.set(tag.parentId, existing);
    }
  }

  // Build a category lookup map
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Build expanded tag sets for every budget line
  const budgetLineTagSets = new Map<string, Set<string>>();
  for (const bl of budgetLines) {
    const directTagIds = bl.tags.map((blt) => blt.tag.id);
    budgetLineTagSets.set(bl.id, collectDescendantTagIds(directTagIds, childrenMap));
  }

  // Determine the rollover history start from the budget chain
  const rolloverLines = budgetLines.filter((bl) => bl.rollover);
  const needsHistory = rolloverLines.length > 0;
  const rolloverHistoryStart = needsHistory
    ? findRolloverHistoryStart(applicableBudget, allBudgets)
    : viewPeriod.start;

  // Compute the earliest date we need transactions for (rollover history or view start)
  const effectiveStart =
    rolloverHistoryStart < viewPeriod.start ? rolloverHistoryStart : viewPeriod.start;

  // Load ALL transactions we'll ever need in one query
  const allTransactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: effectiveStart,
        lte: viewPeriod.end,
      },
    },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, isSource: true } },
        },
      },
    },
  });

  // Split transactions into current-period and historical buckets
  const currentPeriodTxs = allTransactions.filter(
    (tx) => tx.date >= viewPeriod.start && tx.date <= viewPeriod.end,
  );
  const historicalTxs = allTransactions.filter((tx) => tx.date < viewPeriod.start);

  /**
   * Given a set of transactions and a budget line's expanded tag set,
   * compute the share of spending that belongs to this budget line.
   * Transactions with multiple matching budget lines have their amount split evenly.
   */
  function computeActual(txs: typeof allTransactions, tagSet: Set<string>): number {
    let total = 0;
    for (const tx of txs) {
      const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);

      if (nonSourceTagIds.length === 0) continue;

      // How many budget lines match this transaction?
      const matchCount = [...budgetLineTagSets.values()].filter((ts) =>
        nonSourceTagIds.some((id) => ts.has(id)),
      ).length;

      if (matchCount > 0 && nonSourceTagIds.some((id) => tagSet.has(id))) {
        total += (tx.debit - tx.credit) / matchCount;
      }
    }
    return total;
  }

  // Build per-budget-line actuals for the current view period
  const budgetActuals = new Map<string, number>();
  for (const [blId, tagSet] of budgetLineTagSets) {
    budgetActuals.set(blId, computeActual(currentPeriodTxs, tagSet));
  }

  // Calculate summary lines (rollover computed fully in memory)
  const summaryLines = [];

  for (const bl of budgetLines) {
    const period = bl.period as BudgetPeriodType;
    const tagSet = budgetLineTagSets.get(bl.id)!;
    const scaledBudget = scaleBudgetAmount(
      bl.amount,
      period,
      viewPeriod,
      applicableBudget.startDate,
    );
    const actualSpending = budgetActuals.get(bl.id) ?? 0;

    let rolloverAmount = 0;
    if (bl.rollover) {
      // Rollover should never include periods before the currently applicable budget starts.
      // This guarantees the first month/period of a budget has zero rollover.
      const lineRolloverStart =
        applicableBudget.startDate > rolloverHistoryStart
          ? applicableBudget.startDate
          : rolloverHistoryStart;

      const completePeriods = getCompletePeriodsBetween(
        period,
        lineRolloverStart,
        viewPeriod.start,
        applicableBudget.startDate,
      );

      for (const p of completePeriods) {
        const periodBudget = scaleBudgetAmount(
          bl.amount,
          period,
          { start: p.start, end: p.end, label: '', type: 'custom' },
          applicableBudget.startDate,
        );

        // Filter already-loaded historical transactions to this sub-period
        const periodTxs = historicalTxs.filter((tx) => tx.date >= p.start && tx.date <= p.end);
        const periodActual = computeActual(periodTxs, tagSet);
        rolloverAmount += periodBudget - periodActual;
      }
    }

    const effectiveBudget = scaledBudget + rolloverAmount;
    const remaining = effectiveBudget - actualSpending;

    // Look up category details
    const category = bl.categoryId ? (categoryMap.get(bl.categoryId) ?? null) : null;

    summaryLines.push({
      budgetLine: {
        id: bl.id,
        name: bl.name,
        period: bl.period,
        amount: bl.amount,
        rollover: bl.rollover,
        order: bl.order,
        categoryId: bl.categoryId,
        category: category ? { id: category.id, name: category.name, order: category.order } : null,
        tags: bl.tags.map((blt) => blt.tag),
      },
      scaledBudget,
      actualSpending,
      remaining,
      rolloverAmount,
      effectiveBudget,
    });
  }

  const totalIncome = currentPeriodTxs.reduce((sum, tx) => sum + tx.credit, 0);
  const totalDebits = currentPeriodTxs.reduce((sum, tx) => sum + tx.debit, 0);

  return NextResponse.json({
    activeBudget: applicableBudget,
    lines: summaryLines,
    totalIncome,
    totalDebits,
  });
}
