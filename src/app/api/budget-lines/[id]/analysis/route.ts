import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectDescendantTagIds } from '@/lib/tag-tree';
import { getYearlyAmount, buildMonthList } from '@/lib/date-utils';
import type { BudgetPeriodType } from '@/lib/date-utils';
import { fromCents, fromComputedCents } from '@/lib/money';
import { getNonSourceTagIds, isFullyTracked, matchingTagSetIndexes } from '@/lib/tag-allocation';

/** Build a yyyy-MM key from a Date using UTC fields to avoid local-timezone drift. */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// GET /api/budget-lines/:id/analysis?tagIds=id1,id2
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tagIdsParam = searchParams.get('tagIds');

  // Load the budget line
  const budgetLine = await prisma.budgetLine.findUnique({
    where: { id },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
  });

  if (!budgetLine) {
    return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
  }

  // Resolve the budget context from the selected line itself.
  // This avoids mixing historical windows and totals from an unrelated "active" budget.
  const budget = await prisma.budget.findUnique({ where: { id: budgetLine.budgetId } });
  if (!budget) {
    return NextResponse.json({ error: 'Budget not found for budget line' }, { status: 404 });
  }

  const today = new Date();
  const budgetStart = budget.startDate;

  // Fine-tuning should consider the full imported transaction history for these tags,
  // not only transactions that happened after the selected line's budget took effect.
  // This keeps historical spending available after creating/copying a new budget.
  const earliestTransaction = await prisma.transaction.findFirst({
    where: { archived: false },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  const analysisStart = earliestTransaction?.date ?? budgetStart;

  // Build children map for descendant expansion
  const allTags = await prisma.tag.findMany({ select: { id: true, parentId: true } });
  const childrenMap = new Map<string, string[]>();
  for (const tag of allTags) {
    if (tag.parentId) {
      const existing = childrenMap.get(tag.parentId) ?? [];
      existing.push(tag.id);
      childrenMap.set(tag.parentId, existing);
    }
  }

  // Resolve effective tag IDs.
  // Distinguish between "param absent" (use saved tags) vs "param present but empty" (preview no tags).
  const hasTagIdsParam = searchParams.has('tagIds');
  let directTagIds: string[];
  if (hasTagIdsParam) {
    directTagIds = (tagIdsParam ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (directTagIds.length > 200 || new Set(directTagIds).size !== directTagIds.length) {
      return NextResponse.json(
        { error: 'tagIds must contain at most 200 unique ids' },
        { status: 400 },
      );
    }
  } else {
    directTagIds = budgetLine.tags.map((blt) => blt.tag.id);
  }
  const expandedTagIds = collectDescendantTagIds(directTagIds, childrenMap);

  const siblingLines = await prisma.budgetLine.findMany({
    where: { budgetId: budget.id, id: { not: id } },
    include: { tags: { select: { tagId: true } } },
  });
  const allTagSets = [
    expandedTagIds,
    ...siblingLines.map((line) =>
      collectDescendantTagIds(
        line.tags.map((entry) => entry.tagId),
        childrenMap,
      ),
    ),
  ];
  const coveredTags = new Set(allTagSets.flatMap((set) => [...set]));

  // Load non-archived transactions from the earliest transaction to today
  const endOfToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999),
  );

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: analysisStart, lte: endOfToday },
      archived: false,
    },
    include: {
      tags: {
        include: { tag: { select: { id: true, name: true, color: true, isSource: true } } },
      },
    },
    orderBy: { date: 'desc' },
    take: 50_001,
  });
  if (transactions.length > 50_000) {
    return NextResponse.json({ error: 'Too many transactions for analysis' }, { status: 413 });
  }

  // Group transactions by month, summing (debit - credit) for matching non-source tags
  const monthSpendingMap = new Map<string, { spending: number; count: number }>();
  const relevantTransactions: typeof transactions = [];

  for (const tx of transactions) {
    const nonSourceTagIds = getNonSourceTagIds(tx.tags.map((entry) => entry.tag));
    if (!isFullyTracked(nonSourceTagIds, coveredTags)) continue;
    const matches = matchingTagSetIndexes(nonSourceTagIds, allTagSets);
    if (!matches.includes(0)) continue;

    relevantTransactions.push(tx);

    const monthKey = utcMonthKey(new Date(tx.date));
    const existing = monthSpendingMap.get(monthKey) ?? { spending: 0, count: 0 };
    const net = (tx.debit - tx.credit) / matches.length;
    monthSpendingMap.set(monthKey, {
      spending: existing.spending + net,
      count: existing.count + 1,
    });
  }

  // Build complete month list from the earliest transaction up to (but NOT including) the current month.
  // The current month is always partial, so including it would skew statistics.
  // All arithmetic is done in UTC to avoid local-timezone drift.
  // Last complete month = month before today (handles January → December roll-back)
  let lastCompleteYear = today.getUTCFullYear();
  let lastCompleteMonth = today.getUTCMonth() - 1; // 0-indexed
  if (lastCompleteMonth < 0) {
    lastCompleteMonth = 11;
    lastCompleteYear -= 1;
  }

  const monthList = buildMonthList(new Date(analysisStart), lastCompleteYear, lastCompleteMonth);
  const monthlyData = monthList.map((key) => {
    const entry = monthSpendingMap.get(key);
    return {
      month: key,
      spending: entry ? fromComputedCents(Math.max(0, entry.spending)) : 0,
      transactionCount: entry?.count ?? 0,
    };
  });

  // Calculate statistics
  const spendingValues = monthlyData.map((m) => m.spending);
  const monthCount = spendingValues.length;
  const totalSpending = spendingValues.reduce((a, b) => a + b, 0);
  const average = monthCount > 0 ? totalSpending / monthCount : 0;

  const variance =
    monthCount > 1
      ? spendingValues.reduce((acc, v) => acc + (v - average) ** 2, 0) / (monthCount - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const cv = average > 0 ? stdDev / average : 0;

  const nonZeroMonths = monthlyData.filter((m) => m.spending > 0);
  const nonZeroMonthCount = nonZeroMonths.length;

  const minVal = spendingValues.length > 0 ? Math.min(...spendingValues) : 0;
  const maxVal = spendingValues.length > 0 ? Math.max(...spendingValues) : 0;

  const highestMonth =
    nonZeroMonths.length > 0
      ? nonZeroMonths.reduce((best, m) => (m.spending > best.spending ? m : best)).month
      : null;
  const lowestNonZeroMonth =
    nonZeroMonths.length > 0
      ? nonZeroMonths.reduce((best, m) => (m.spending < best.spending ? m : best)).month
      : null;

  // Income sources total yearly
  const incomeSources = await prisma.incomeSource.findMany({
    where: { budgetId: budget.id },
  });
  const totalYearlyIncome = incomeSources.reduce(
    (sum, src) => sum + getYearlyAmount(src.netAmount, src.netPeriod as BudgetPeriodType),
    0,
  );

  // All OTHER budget lines yearly total (for context)
  const totalYearlyBudget = siblingLines.reduce(
    (sum, bl) => sum + getYearlyAmount(bl.amount, bl.period as BudgetPeriodType),
    0,
  );

  return NextResponse.json({
    budgetLine: {
      id: budgetLine.id,
      name: budgetLine.name,
      period: budgetLine.period,
      amount: fromCents(budgetLine.amount),
      rollover: budgetLine.rollover,
      order: budgetLine.order,
      categoryId: budgetLine.categoryId,
      tags: budgetLine.tags.map((blt) => blt.tag),
    },
    activeBudget: {
      id: budget.id,
      startDate: budget.startDate.toISOString(),
    },
    analysisStartDate: analysisStart.toISOString(),
    monthlyData,
    stats: {
      average,
      stdDev,
      min: minVal,
      max: maxVal,
      cv,
      monthCount,
      nonZeroMonthCount,
      totalSpending,
      highestMonth,
      lowestNonZeroMonth,
    },
    totalYearlyIncome: fromComputedCents(totalYearlyIncome),
    totalYearlyBudget: fromComputedCents(totalYearlyBudget),
    transactions: relevantTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      name: tx.name,
      normalizedName: tx.normalizedName,
      debit: fromCents(tx.debit),
      credit: fromCents(tx.credit),
      source: tx.source,
      notes: tx.notes,
      archived: tx.archived,
      tags: tx.tags.map((tt) => tt.tag),
    })),
  });
}
