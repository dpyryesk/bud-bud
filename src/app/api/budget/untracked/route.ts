import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectDescendantTagIds } from '@/lib/tag-tree';
import type { Budget } from '@/generated/prisma/client';

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

// GET /api/budget/untracked - Debit transactions not covered by any budget line
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  // Both params are expected as date-only strings (YYYY-MM-DD), parsed as UTC midnight.
  // Extend the end date to UTC end-of-day so the transaction filter covers the full last day.
  const periodStart = new Date(start);
  const periodEndMidnight = new Date(end);
  const periodEnd = new Date(
    Date.UTC(
      periodEndMidnight.getUTCFullYear(),
      periodEndMidnight.getUTCMonth(),
      periodEndMidnight.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  // Load all budgets to find the one applicable to this period
  const allBudgets = await prisma.budget.findMany({ orderBy: { startDate: 'asc' } });

  if (allBudgets.length === 0) {
    return NextResponse.json({ totalUntracked: 0, transactions: [] });
  }

  const applicableBudget = findApplicableBudget(allBudgets, periodStart);

  // Load budget lines (scoped to applicable budget) and all tags in parallel
  const [budgetLines, allTags] = await Promise.all([
    prisma.budgetLine.findMany({
      where: { budgetId: applicableBudget.id },
      include: {
        tags: {
          include: {
            tag: { select: { id: true } },
          },
        },
      },
    }),
    prisma.tag.findMany({ select: { id: true, parentId: true } }),
  ]);

  // Build parent→children map
  const childrenMap = new Map<string, string[]>();
  for (const tag of allTags) {
    if (tag.parentId) {
      const existing = childrenMap.get(tag.parentId) ?? [];
      existing.push(tag.id);
      childrenMap.set(tag.parentId, existing);
    }
  }

  // Build expanded tag sets for every budget line
  const allBudgetTagIds = new Set<string>();
  for (const bl of budgetLines) {
    const directTagIds = bl.tags.map((blt) => blt.tag.id);
    const expanded = collectDescendantTagIds(directTagIds, childrenMap);
    for (const id of expanded) {
      allBudgetTagIds.add(id);
    }
  }

  // Load all debit transactions in the period with their tags
  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      debit: { gt: 0 },
    },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Filter to transactions not covered by any budget line
  const untrackedTransactions = transactions.filter((tx) => {
    const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);

    // Untracked if: no non-source tags, OR none of the non-source tags are in any budget line tag set
    return nonSourceTagIds.length === 0 || !nonSourceTagIds.some((id) => allBudgetTagIds.has(id));
  });

  const totalUntracked = untrackedTransactions.reduce((sum, tx) => sum + tx.debit, 0);

  const formatted = untrackedTransactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    name: t.name,
    normalizedName: t.normalizedName,
    debit: t.debit,
    credit: t.credit,
    source: t.source,
    notes: t.notes,
    tags: t.tags.map((tt) => tt.tag),
  }));

  return NextResponse.json({ totalUntracked, transactions: formatted });
}
