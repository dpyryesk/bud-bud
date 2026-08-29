import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transactionWithTagsFromCents } from '@/lib/api-formatters';
import {
  nameSchema,
  orderSchema,
  parseDateRange,
  readJson,
  tagIdsSchema,
} from '@/lib/api-validation';
import {
  buildChildrenMap,
  buildCoveredTagsByBudget,
  findApplicableBudget,
} from '@/lib/budget-coverage';
import { fromComputedCents } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { getNonSourceTagIds, isFullyTracked } from '@/lib/tag-allocation';
import { collectDescendantTagIds } from '@/lib/tag-tree';

const createSchema = z
  .object({
    year: z.number().int().min(1900).max(9999),
    name: nameSchema,
    tagIds: tagIdsSchema.default([]),
    order: orderSchema.optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const range = parseDateRange(request.nextUrl.searchParams);
  if (!range.success) return range.response;
  const requestedYear = z.coerce
    .number()
    .int()
    .min(1900)
    .max(9999)
    .safeParse(request.nextUrl.searchParams.get('year'));
  if (!requestedYear.success) {
    return NextResponse.json({ error: 'Valid year query param is required' }, { status: 400 });
  }
  const [budgets, lines, categories, tags, transactions] = await Promise.all([
    prisma.budget.findMany({ orderBy: { startDate: 'asc' } }),
    prisma.budgetLine.findMany({
      select: { budgetId: true, tags: { select: { tag: { select: { id: true } } } } },
    }),
    prisma.untrackedCategory.findMany({
      where: { year: requestedYear.data },
      orderBy: { order: 'asc' },
      include: {
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, isSource: true, parentId: true } },
          },
        },
      },
    }),
    prisma.tag.findMany({ select: { id: true, parentId: true } }),
    prisma.transaction.findMany({
      where: {
        date: { gte: range.start, lte: range.end },
        // Untracked categories describe spending. Credits such as salary or
        // other income must not appear in the uncategorized spending list.
        debit: { gt: 0 },
        archived: false,
      },
      include: {
        tags: {
          include: { tag: { select: { id: true, name: true, color: true, isSource: true } } },
        },
      },
      orderBy: { date: 'desc' },
      take: 10_001,
    }),
  ]);
  if (transactions.length > 10_000) {
    return NextResponse.json(
      { error: 'Too many transactions; narrow the date range' },
      { status: 413 },
    );
  }
  const childrenMap = buildChildrenMap(tags);
  const coveredByBudget = buildCoveredTagsByBudget(lines, childrenMap);
  const categoryData = categories.map((category) => {
    const directIds = category.tags.map((entry) => entry.tag.id).sort();
    return {
      category,
      directIds,
      expanded: collectDescendantTagIds(directIds, childrenMap),
      key: category.id,
    };
  });
  const aggregate = new Map<
    string,
    { representative: (typeof categoryData)[number]; spending: number }
  >();
  for (const entry of categoryData) {
    if (!aggregate.has(entry.key)) {
      aggregate.set(entry.key, { representative: entry, spending: 0 });
    }
  }

  const trulyUncategorized = [];
  for (const transaction of transactions) {
    const budget = findApplicableBudget(budgets, transaction.date);
    const tagIds = getNonSourceTagIds(transaction.tags.map((entry) => entry.tag));
    const tracked = budget
      ? isFullyTracked(tagIds, coveredByBudget.get(budget.id) ?? new Set<string>())
      : false;
    if (tracked) continue;
    const match = categoryData.find((entry) => tagIds.some((tagId) => entry.expanded.has(tagId)));
    if (match) {
      const item = aggregate.get(match.key) ?? { representative: match, spending: 0 };
      item.spending += transaction.debit - transaction.credit;
      aggregate.set(match.key, item);
    } else {
      trulyUncategorized.push(transaction);
    }
  }

  return NextResponse.json({
    categories: [...aggregate.values()].map(({ representative, spending }) => ({
      id: representative.category.id,
      year: representative.category.year,
      name: representative.category.name,
      order: representative.category.order,
      tags: representative.category.tags.map((entry) => entry.tag),
      actualSpending: fromComputedCents(spending),
    })),
    totalTrulyUncategorized: fromComputedCents(
      trulyUncategorized.reduce(
        (sum, transaction) => sum + transaction.debit - transaction.credit,
        0,
      ),
    ),
    trulyUncategorizedTransactions: trulyUncategorized.map(transactionWithTagsFromCents),
  });
}

export async function POST(request: NextRequest) {
  const body = await readJson(request, createSchema);
  if (!body.success) return body.response;
  const result = await prisma.$transaction(async (tx) => {
    const [tags] = await Promise.all([
      tx.tag.findMany({
        where: { id: { in: body.data.tagIds }, isSource: false },
        select: { id: true },
      }),
    ]);
    if (tags.length !== body.data.tagIds.length) return { kind: 'tags' as const };
    const maximum = await tx.untrackedCategory.aggregate({
      where: { year: body.data.year },
      _max: { order: true },
    });
    const category = await tx.untrackedCategory.create({
      data: {
        year: body.data.year,
        name: body.data.name,
        order: body.data.order ?? (maximum._max.order ?? -1) + 1,
        tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
      },
      include: { tags: { include: { tag: true } } },
    });
    return { kind: 'ok' as const, category };
  });
  if (result.kind === 'tags')
    return NextResponse.json({ error: 'All tagIds must be category tags' }, { status: 400 });
  return NextResponse.json(
    { ...result.category, tags: result.category.tags.map((entry) => entry.tag) },
    { status: 201 },
  );
}
