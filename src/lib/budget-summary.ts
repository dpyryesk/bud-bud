import type { BudgetPeriodType } from '@/lib/date-utils';
import {
  buildMonthList,
  getCompletePeriodsBetween,
  getYearlyAmount,
  scaleBudgetAmount,
} from '@/lib/date-utils';
import { buildChildrenMap, findApplicableBudget } from '@/lib/budget-coverage';
import { fromCents, fromComputedCents } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { getNonSourceTagIds, isFullyTracked, matchingTagSetIndexes } from '@/lib/tag-allocation';
import { collectDescendantTagIds } from '@/lib/tag-tree';
import type { FitStatus } from '@/types';

const TRANSACTION_CALCULATION_LIMIT = 50_000;

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fitStatus(projected: number, averageMonthly: number, months: number): FitStatus {
  if (months < 3 || averageMonthly === 0) return 'insufficient';
  const delta = Math.abs(projected - averageMonthly * 12) / (averageMonthly * 12);
  return delta <= 0.1 ? 'green' : delta <= 0.25 ? 'yellow' : 'red';
}

function daysInclusive(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Prorate calendar budgets when a budget becomes effective part-way through a month/year. */
function scaleEffectiveAmount(
  amount: number,
  period: BudgetPeriodType,
  start: Date,
  end: Date,
  anchor: Date,
) {
  if (period === 'biweekly') {
    return scaleBudgetAmount(amount, period, { start, end, label: '', type: 'custom' }, anchor);
  }
  let total = 0;
  let cursor = new Date(start);
  while (cursor <= end) {
    const periodEnd =
      period === 'monthly'
        ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999))
        : new Date(Date.UTC(cursor.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
    const sliceEnd = periodEnd < end ? periodEnd : end;
    const periodStart =
      period === 'monthly'
        ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
        : new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
    total += amount * (daysInclusive(cursor, sliceEnd) / daysInclusive(periodStart, periodEnd));
    cursor = new Date(sliceEnd.getTime() + 1);
  }
  return total;
}

export async function buildBudgetSummary(start: Date, end: Date) {
  const [budgets, allTags, allLines] = await Promise.all([
    prisma.budget.findMany({ orderBy: { startDate: 'asc' } }),
    prisma.tag.findMany({ select: { id: true, parentId: true } }),
    prisma.budgetLine.findMany({
      include: {
        category: true,
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, isSource: true, parentId: true } },
          },
        },
      },
      orderBy: [{ budgetId: 'asc' }, { categoryId: 'asc' }, { order: 'asc' }],
    }),
  ]);
  if (!budgets.length) return null;

  const childrenMap = buildChildrenMap(allTags);
  const lineData = allLines.map((line) => {
    const directTagIds = line.tags.map((entry) => entry.tag.id).sort();
    return {
      line,
      directTagIds,
      tagSet: collectDescendantTagIds(directTagIds, childrenMap),
      key: `${line.name}\u0000${line.period}\u0000${directTagIds.join(',')}`,
    };
  });
  const linesByBudget = new Map(
    budgets.map((budget) => [
      budget.id,
      lineData.filter((entry) => entry.line.budgetId === budget.id),
    ]),
  );

  const segments = budgets.flatMap((budget, index) => {
    const nextStart = budgets[index + 1]?.startDate;
    const segmentStart = new Date(Math.max(start.getTime(), budget.startDate.getTime()));
    const segmentEnd = new Date(
      Math.min(end.getTime(), nextStart ? nextStart.getTime() - 1 : end.getTime()),
    );
    return segmentStart <= segmentEnd ? [{ budget, start: segmentStart, end: segmentEnd }] : [];
  });

  const currentTransactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lte: end }, archived: false },
    include: { tags: { include: { tag: { select: { id: true, isSource: true } } } } },
    take: TRANSACTION_CALCULATION_LIMIT + 1,
  });
  if (currentTransactions.length > TRANSACTION_CALCULATION_LIMIT) {
    throw new RangeError('Too many transactions for one budget calculation; narrow the date range');
  }

  type Aggregate = {
    representative: (typeof lineData)[number];
    scaled: number;
    actual: number;
    rollover: number;
  };
  const aggregate = new Map<string, Aggregate>();
  for (const segment of segments) {
    const entries = linesByBudget.get(segment.budget.id) ?? [];
    for (const entry of entries) {
      if (!aggregate.has(entry.key)) {
        aggregate.set(entry.key, { representative: entry, scaled: 0, actual: 0, rollover: 0 });
      }
      aggregate.get(entry.key)!.scaled += scaleEffectiveAmount(
        entry.line.amount,
        entry.line.period as BudgetPeriodType,
        segment.start,
        segment.end,
        segment.budget.startDate,
      );
    }
    const tagSets = entries.map((entry) => entry.tagSet);
    const covered = new Set(tagSets.flatMap((set) => [...set]));
    for (const transaction of currentTransactions) {
      if (transaction.date < segment.start || transaction.date > segment.end) continue;
      const tagIds = getNonSourceTagIds(transaction.tags.map((entry) => entry.tag));
      if (!isFullyTracked(tagIds, covered)) continue;
      const matches = matchingTagSetIndexes(tagIds, tagSets);
      for (const index of matches) {
        aggregate.get(entries[index].key)!.actual +=
          (transaction.debit - transaction.credit) / matches.length;
      }
    }
  }

  const activeBudget = findApplicableBudget(budgets, start);
  const activeEntries = activeBudget ? (linesByBudget.get(activeBudget.id) ?? []) : [];
  const rolloverEntries = activeEntries.filter(
    (entry) => entry.line.rollover && aggregate.has(entry.key),
  );
  if (rolloverEntries.length) {
    let earliestHistory = start;
    const historyStarts = new Map<string, Date>();
    const activeIndex = budgets.findIndex((budget) => budget.id === activeBudget!.id);
    for (const entry of rolloverEntries) {
      let index = activeIndex;
      while (index > 0 && !budgets[index].resetRollover) index -= 1;
      const historyStart = budgets[index].startDate;
      historyStarts.set(entry.key, historyStart);
      if (historyStart < earliestHistory) earliestHistory = historyStart;
    }
    const historyTransactions = await prisma.transaction.findMany({
      where: { date: { gte: earliestHistory, lt: start }, archived: false },
      include: { tags: { include: { tag: { select: { id: true, isSource: true } } } } },
      take: TRANSACTION_CALCULATION_LIMIT + 1,
    });
    if (historyTransactions.length > TRANSACTION_CALCULATION_LIMIT) {
      throw new RangeError('Too many rollover transactions; choose a narrower period');
    }
    for (const entry of rolloverEntries) {
      const periods = getCompletePeriodsBetween(
        entry.line.period as BudgetPeriodType,
        historyStarts.get(entry.key)!,
        start,
        activeBudget!.startDate,
      );
      for (const period of periods) {
        const budget = findApplicableBudget(budgets, period.start);
        if (!budget) continue;
        const budgetEntries = linesByBudget.get(budget.id) ?? [];
        const bestOverlap = budgetEntries
          .map((candidate) => ({
            candidate,
            overlap: candidate.directTagIds.filter((id) => entry.directTagIds.includes(id)).length,
          }))
          .sort((a, b) => b.overlap - a.overlap)[0];
        const historical =
          budgetEntries.find((candidate) => candidate.key === entry.key) ??
          (bestOverlap && bestOverlap.overlap > 0 ? bestOverlap.candidate : undefined);
        if (!historical) continue;
        const periodBudget = scaleBudgetAmount(
          historical.line.amount,
          historical.line.period as BudgetPeriodType,
          { start: period.start, end: period.end, label: '', type: 'custom' },
          budget.startDate,
        );
        const tagSets = budgetEntries.map((candidate) => candidate.tagSet);
        const targetIndex = budgetEntries.indexOf(historical);
        const covered = new Set(tagSets.flatMap((set) => [...set]));
        let periodActual = 0;
        for (const transaction of historyTransactions) {
          if (transaction.date < period.start || transaction.date > period.end) continue;
          const tagIds = getNonSourceTagIds(transaction.tags.map((tag) => tag.tag));
          if (!isFullyTracked(tagIds, covered)) continue;
          const matches = matchingTagSetIndexes(tagIds, tagSets);
          if (matches.includes(targetIndex)) {
            periodActual += (transaction.debit - transaction.credit) / matches.length;
          }
        }
        aggregate.get(entry.key)!.rollover += periodBudget - periodActual;
      }
    }
  }

  const now = new Date();
  const fitEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  const earliest = await prisma.transaction.findFirst({
    where: { archived: false },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  const fitStart = earliest?.date;
  const fitMonths = fitStart
    ? buildMonthList(fitStart, fitEnd.getUTCFullYear(), fitEnd.getUTCMonth())
    : [];
  const fitSpending = new Map<string, Map<string, number>>();
  if (fitStart && fitStart <= fitEnd && fitMonths.length) {
    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: fitStart, lte: fitEnd }, archived: false },
      include: { tags: { include: { tag: { select: { id: true, isSource: true } } } } },
      take: TRANSACTION_CALCULATION_LIMIT + 1,
    });
    if (transactions.length > TRANSACTION_CALCULATION_LIMIT) {
      throw new RangeError('Too many transactions for fit analysis');
    }
    for (const transaction of transactions) {
      const budget = findApplicableBudget(budgets, transaction.date);
      if (!budget) continue;
      const entries = linesByBudget.get(budget.id) ?? [];
      const tagSets = entries.map((entry) => entry.tagSet);
      const covered = new Set(tagSets.flatMap((set) => [...set]));
      const tagIds = getNonSourceTagIds(transaction.tags.map((entry) => entry.tag));
      if (!isFullyTracked(tagIds, covered)) continue;
      const matches = matchingTagSetIndexes(tagIds, tagSets);
      for (const index of matches) {
        const byMonth = fitSpending.get(entries[index].key) ?? new Map<string, number>();
        const key = monthKey(transaction.date);
        byMonth.set(
          key,
          (byMonth.get(key) ?? 0) + (transaction.debit - transaction.credit) / matches.length,
        );
        fitSpending.set(entries[index].key, byMonth);
      }
    }
  }

  const lines = [...aggregate.values()].map((value) => {
    const line = value.representative.line;
    const effective = value.scaled + value.rollover;
    const average = fitMonths.length
      ? fitMonths.reduce(
          (sum, month) =>
            sum + Math.max(0, fitSpending.get(value.representative.key)?.get(month) ?? 0),
          0,
        ) / fitMonths.length
      : 0;
    return {
      budgetLine: {
        id: line.id,
        identityKey: value.representative.key,
        name: line.name,
        period: line.period,
        amount: fromCents(line.amount),
        rollover: line.rollover,
        order: line.order,
        categoryId: line.categoryId,
        category: line.category
          ? { id: line.category.id, name: line.category.name, order: line.category.order }
          : null,
        tags: line.tags.map((entry) => entry.tag),
      },
      scaledBudget: fromComputedCents(value.scaled),
      actualSpending: fromComputedCents(value.actual),
      remaining: fromComputedCents(effective - value.actual),
      rolloverAmount: fromComputedCents(value.rollover),
      effectiveBudget: fromComputedCents(effective),
      fitStatus: fitStatus(
        getYearlyAmount(line.amount, line.period as BudgetPeriodType),
        average,
        fitMonths.length,
      ),
      fitMonthCount: fitMonths.length,
    };
  });

  return {
    activeBudget,
    lines,
    totalIncome: fromCents(
      currentTransactions.reduce((sum, transaction) => sum + transaction.credit, 0),
    ),
    totalDebits: fromCents(
      currentTransactions.reduce((sum, transaction) => sum + transaction.debit, 0),
    ),
  };
}
