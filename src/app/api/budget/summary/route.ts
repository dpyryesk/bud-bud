import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  scaleBudgetAmount,
  getCompletePeriodsBetween,
  type BudgetPeriodType,
} from '@/lib/date-utils';

/**
 * Recursively collect all descendant tag IDs for a given set of tag IDs.
 * Uses a pre-built children map to avoid DB calls in the loop.
 */
function collectDescendantTagIds(
  tagIds: string[],
  childrenMap: Map<string, string[]>,
): Set<string> {
  const allIds = new Set(tagIds);
  const queue = [...tagIds];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenMap.get(currentId) ?? [];
    for (const childId of children) {
      if (!allIds.has(childId)) {
        allIds.add(childId);
        queue.push(childId);
      }
    }
  }

  return allIds;
}

// GET /api/budget/summary - Computed budget vs actual for period
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  const viewPeriod = {
    start: new Date(start),
    end: new Date(end),
    label: '',
    type: 'custom' as const,
  };

  // Load all data in parallel upfront - no N+1 in the loops below
  const [budgetLines, allTags, earliestTx] = await Promise.all([
    prisma.budgetLine.findMany({
      include: {
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, isSource: true } },
          },
        },
      },
    }),
    // Load all tags so we can build a complete children map in memory
    prisma.tag.findMany({ select: { id: true, parentId: true } }),
    prisma.transaction.findFirst({
      orderBy: { date: 'asc' },
      select: { date: true },
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

  // Build expanded tag sets for every budget line
  const budgetLineTagSets = new Map<string, Set<string>>();
  for (const bl of budgetLines) {
    const directTagIds = bl.tags.map((blt) => blt.tag.id);
    budgetLineTagSets.set(bl.id, collectDescendantTagIds(directTagIds, childrenMap));
  }

  // Determine the full historical date range we need (for rollover budget lines)
  const rolloverLines = budgetLines.filter((bl) => bl.rollover);
  const needsHistory = rolloverLines.length > 0 && earliestTx !== null;

  // Compute the earliest date we need transactions for (rollover history or view start)
  const historyStart = needsHistory && earliestTx ? earliestTx.date : viewPeriod.start;
  const effectiveStart = historyStart < viewPeriod.start ? historyStart : viewPeriod.start;

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
    const scaledBudget = scaleBudgetAmount(bl.amount, period, viewPeriod);
    const actualSpending = budgetActuals.get(bl.id) ?? 0;

    let rolloverAmount = 0;
    if (bl.rollover && earliestTx) {
      const completePeriods = getCompletePeriodsBetween(period, earliestTx.date, viewPeriod.start);

      for (const p of completePeriods) {
        const periodBudget = scaleBudgetAmount(bl.amount, period, {
          start: p.start,
          end: p.end,
          label: '',
          type: 'custom',
        });

        // Filter already-loaded historical transactions to this sub-period
        const periodTxs = historicalTxs.filter((tx) => tx.date >= p.start && tx.date <= p.end);
        const periodActual = computeActual(periodTxs, tagSet);
        rolloverAmount += periodBudget - periodActual;
      }
    }

    const effectiveBudget = scaledBudget + rolloverAmount;
    const remaining = effectiveBudget - actualSpending;

    summaryLines.push({
      budgetLine: {
        id: bl.id,
        name: bl.name,
        period: bl.period,
        amount: bl.amount,
        rollover: bl.rollover,
        tags: bl.tags.map((blt) => blt.tag),
      },
      scaledBudget,
      actualSpending,
      remaining,
      rolloverAmount,
      effectiveBudget,
    });
  }

  return NextResponse.json(summaryLines);
}
