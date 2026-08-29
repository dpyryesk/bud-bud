import { NextRequest, NextResponse } from 'next/server';
import { transactionWithTagsFromCents } from '@/lib/api-formatters';
import { parseDateRange } from '@/lib/api-validation';
import {
  buildChildrenMap,
  buildCoveredTagsByBudget,
  findApplicableBudget,
} from '@/lib/budget-coverage';
import { fromCents } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { getNonSourceTagIds, isFullyTracked } from '@/lib/tag-allocation';

export async function GET(request: NextRequest) {
  const range = parseDateRange(request.nextUrl.searchParams);
  if (!range.success) return range.response;

  const [budgets, lines, tags, transactions] = await Promise.all([
    prisma.budget.findMany({ orderBy: { startDate: 'asc' } }),
    prisma.budgetLine.findMany({
      select: { budgetId: true, tags: { select: { tag: { select: { id: true } } } } },
    }),
    prisma.tag.findMany({ select: { id: true, parentId: true } }),
    prisma.transaction.findMany({
      where: {
        date: { gte: range.start, lte: range.end },
        debit: { gt: 0 },
        archived: false,
      },
      include: {
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, isSource: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 10_001,
    }),
  ]);
  if (transactions.length > 10_000) {
    return NextResponse.json(
      { error: 'Too many matching transactions; narrow the date range' },
      { status: 413 },
    );
  }

  const coveredByBudget = buildCoveredTagsByBudget(lines, buildChildrenMap(tags));
  const untracked = transactions.filter((transaction) => {
    const budget = findApplicableBudget(budgets, transaction.date);
    if (!budget) return true;
    return !isFullyTracked(
      getNonSourceTagIds(transaction.tags.map((entry) => entry.tag)),
      coveredByBudget.get(budget.id) ?? new Set<string>(),
    );
  });
  return NextResponse.json({
    totalUntracked: fromCents(untracked.reduce((sum, transaction) => sum + transaction.debit, 0)),
    transactions: untracked.map(transactionWithTagsFromCents),
  });
}
