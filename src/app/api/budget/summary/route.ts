import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  type BudgetPeriodType,
  buildMonthList,
  getCompletePeriodsBetween,
  getYearlyAmount,
  scaleBudgetAmount,
} from '@/lib/date-utils';
import type { Budget } from '@/generated/prisma/client';
import { collectDescendantTagIds } from '@/lib/tag-tree';
import type { FitStatus } from '@/types';

// Fit thresholds — must match src/components/fine-tune/constants.ts
const FIT_GREEN_THRESHOLD = 0.1; // ≤ 10% delta → green
const FIT_YELLOW_THRESHOLD = 0.25; // ≤ 25% delta → yellow

/** Build a yyyy-MM key from a Date using UTC fields to avoid local-timezone drift. */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compute fit status for a budget line given its projected yearly amount
 * vs. average monthly spending over the full history.
 * Uses a 3-month minimum threshold (stricter than fine-tune's 2-month threshold)
 * to avoid showing misleading colour when data is scarce.
 */
function computeFitStatus(
  projectedYearly: number,
  averageMonthlySpending: number,
  monthCount: number,
): FitStatus {
  if (monthCount < 3) return 'insufficient';
  const expectedYearly = averageMonthlySpending * 12;
  if (expectedYearly === 0) return 'insufficient';
  const delta = Math.abs(projectedYearly - expectedYearly) / expectedYearly;
  if (delta <= FIT_GREEN_THRESHOLD) return 'green';
  if (delta <= FIT_YELLOW_THRESHOLD) return 'yellow';
  return 'red';
}

/**
 * Return the latest budget whose startDate <= date.
 * Falls back to the earliest budget if none qualifies (date is before all budgets).
 * Assumes budgets are sorted by startDate asc.
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

  // When resetRollover is false, earlier periods may fall under previous budgets that had
  // different per-line amounts. Load those budgets' lines so the rollover loop can use the
  // historically-correct budget amount for each period instead of always using the current
  // budget line's amount.
  const hasPreviousChainBudgets = needsHistory && rolloverHistoryStart < applicableBudget.startDate;
  const historicalChainLines = hasPreviousChainBudgets
    ? await prisma.budgetLine.findMany({
        where: {
          budgetId: {
            in: allBudgets
              .filter((b) => b.startDate >= rolloverHistoryStart && b.id !== applicableBudget.id)
              .map((b) => b.id),
          },
        },
        include: { tags: { include: { tag: { select: { id: true } } } } },
      })
    : [];

  // Build a lookup: budgetId → list of { amount, period, directTagIds }
  const historicalLinesByBudgetId = new Map<
    string,
    Array<{ amount: number; period: string; directTagIds: string[] }>
  >();
  for (const hbl of historicalChainLines) {
    const existing = historicalLinesByBudgetId.get(hbl.budgetId) ?? [];
    existing.push({
      amount: hbl.amount,
      period: hbl.period,
      directTagIds: hbl.tags.map((t) => t.tag.id),
    });
    historicalLinesByBudgetId.set(hbl.budgetId, existing);
  }

  // --- Fit data date range ---
  // Fit is always computed from the earliest imported transaction to the last fully
  // complete month, regardless of the selected view period. This mirrors the
  // fine-tune analysis endpoint so copied/new budgets keep previous-budget history.
  const today = new Date();
  let fitLastMonth = today.getUTCMonth() - 1; // 0-indexed
  let fitLastYear = today.getUTCFullYear();
  if (fitLastMonth < 0) {
    fitLastMonth = 11;
    fitLastYear -= 1;
  }
  // End of the last complete month (UTC end-of-day)
  const fitPeriodEnd = new Date(Date.UTC(fitLastYear, fitLastMonth + 1, 0, 23, 59, 59, 999));

  const earliestTransaction = await prisma.transaction.findFirst({
    where: { archived: false },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  const fitPeriodStart = earliestTransaction?.date ?? applicableBudget.startDate;

  // Build the list of complete months for fit calculation
  const fitMonthList = buildMonthList(new Date(fitPeriodStart), fitLastYear, fitLastMonth);
  const fitMonthCount = fitMonthList.length;

  // Load ALL transactions we'll ever need in one query (exclude archived)
  const allTransactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: effectiveStart,
        lte: viewPeriod.end,
      },
      archived: false,
    },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, isSource: true } },
        },
      },
    },
  });

  // Load fit-period transactions separately if needed (first transaction → last complete month).
  // This covers cases where the view period doesn't overlap with the full fit range.
  const fitTransactions =
    fitMonthCount > 0 && fitPeriodStart <= fitPeriodEnd
      ? await prisma.transaction.findMany({
          where: {
            date: { gte: fitPeriodStart, lte: fitPeriodEnd },
            archived: false,
          },
          include: {
            tags: {
              include: { tag: { select: { id: true, isSource: true } } },
            },
          },
        })
      : [];

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

  // --- Compute fit status per budget line from full historical data ---
  // For each line: sum spending per complete month, compute average, then assess fit.
  const budgetLineFitMap = new Map<string, { fitStatus: FitStatus; fitMonthCount: number }>();
  for (const [blId, tagSet] of budgetLineTagSets) {
    // Accumulate spending per month key
    const monthSpending = new Map<string, number>();
    for (const tx of fitTransactions) {
      const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);
      if (nonSourceTagIds.length === 0) continue;
      if (!nonSourceTagIds.some((tid) => tagSet.has(tid))) continue;
      const key = utcMonthKey(new Date(tx.date));
      const net = tx.debit - tx.credit;
      monthSpending.set(key, (monthSpending.get(key) ?? 0) + net);
    }

    // Build spending values aligned to the complete month list
    const spendingValues = fitMonthList.map((m) => Math.max(0, monthSpending.get(m) ?? 0));
    const totalSpending = spendingValues.reduce((a, b) => a + b, 0);
    const average = fitMonthCount > 0 ? totalSpending / fitMonthCount : 0;

    // Find the budget line to get its amount & period for projected yearly
    const bl = budgetLines.find((b) => b.id === blId);
    const projectedYearly = bl ? getYearlyAmount(bl.amount, bl.period as BudgetPeriodType) : 0;

    budgetLineFitMap.set(blId, {
      fitStatus: computeFitStatus(projectedYearly, average, fitMonthCount),
      fitMonthCount,
    });
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
      // Use rolloverHistoryStart as computed by findRolloverHistoryStart.
      // When resetRollover is true, findRolloverHistoryStart returns the current budget's
      // own startDate, so rolloverHistoryStart == applicableBudget.startDate and rollover
      // accumulates only within the current budget's period.
      // When resetRollover is false, rolloverHistoryStart may be earlier (reaching back
      // through the chain of non-resetting budgets to the last one that reset), and we
      // correctly accumulate rollover from that earlier start date.
      const completePeriods = getCompletePeriodsBetween(
        period,
        rolloverHistoryStart,
        viewPeriod.start,
        applicableBudget.startDate,
      );

      // Direct tag IDs of this line — used to match against historical budget lines
      const currentDirectTagIds = bl.tags.map((blt) => blt.tag.id);

      for (const p of completePeriods) {
        // Find which budget was active during this sub-period.
        // When resetRollover is false, earlier periods may belong to a previous budget
        // that had different per-line amounts; use that budget's matching line amount.
        const periodBudgetEntry = findApplicableBudget(allBudgets, p.start);

        let periodBudgetValue: number;
        if (periodBudgetEntry.id === applicableBudget.id) {
          // Current budget — use current line's amount and anchor
          periodBudgetValue = scaleBudgetAmount(
            bl.amount,
            period,
            { start: p.start, end: p.end, label: '', type: 'custom' },
            applicableBudget.startDate,
          );
        } else {
          // Previous budget — find the best-matching line by direct tag ID overlap
          const candidates = historicalLinesByBudgetId.get(periodBudgetEntry.id) ?? [];
          const currentTagIdSet = new Set(currentDirectTagIds);
          let bestMatch: { amount: number; period: string } | null = null;
          let bestOverlap = 0;
          for (const candidate of candidates) {
            const overlap = candidate.directTagIds.filter((id) => currentTagIdSet.has(id)).length;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestMatch = candidate;
            }
          }
          periodBudgetValue = bestMatch
            ? scaleBudgetAmount(
                bestMatch.amount,
                bestMatch.period as BudgetPeriodType,
                { start: p.start, end: p.end, label: '', type: 'custom' },
                periodBudgetEntry.startDate,
              )
            : 0; // No matching line in that historical budget → $0 for those periods
        }

        // Filter already-loaded historical transactions to this sub-period
        const periodTxs = historicalTxs.filter((tx) => tx.date >= p.start && tx.date <= p.end);
        const periodActual = computeActual(periodTxs, tagSet);
        rolloverAmount += periodBudgetValue - periodActual;
      }
    }

    const effectiveBudget = scaledBudget + rolloverAmount;
    const remaining = effectiveBudget - actualSpending;

    // Look up category details
    const category = bl.categoryId ? (categoryMap.get(bl.categoryId) ?? null) : null;

    const fitData = budgetLineFitMap.get(bl.id) ?? {
      fitStatus: 'insufficient' as FitStatus,
      fitMonthCount: 0,
    };

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
      fitStatus: fitData.fitStatus,
      fitMonthCount: fitData.fitMonthCount,
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
