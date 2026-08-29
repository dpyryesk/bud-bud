import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { transactionWithTagsFromCents } from '@/lib/api-formatters';
import { dateOnlySchema, moneyInputSchema } from '@/lib/api-validation';
import {
  buildChildrenMap,
  buildCoveredTagsByBudget,
  findApplicableBudget,
} from '@/lib/budget-coverage';
import { toCents } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { getNonSourceTagIds, isFullyTracked } from '@/lib/tag-allocation';
import { collectDescendantTagIds } from '@/lib/tag-tree';

const querySchema = z
  .object({
    start: dateOnlySchema.optional(),
    end: dateOnlySchema.optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    tagId: z.string().trim().min(1).max(128).optional(),
    tagIds: z.string().max(10_000).optional(),
    untaggedOnly: z.enum(['true', 'false']).optional(),
    unbudgeted: z.enum(['true', 'false']).optional(),
    budgeted: z.enum(['true', 'false']).optional(),
    uncategorizedOnly: z.enum(['true', 'false']).optional(),
    type: z.enum(['debit', 'credit']).optional(),
    search: z.string().trim().max(200).optional(),
    minAmount: moneyInputSchema.optional(),
    maxAmount: moneyInputSchema.optional(),
    archived: z.enum(['true', 'false']).optional(),
  })
  .superRefine((value, context) => {
    if ((value.start == null) !== (value.end == null)) {
      context.addIssue({ code: 'custom', message: 'start and end must be supplied together' });
    }
    if (value.start && value.end && value.start > value.end) {
      context.addIssue({ code: 'custom', message: 'start must be on or before end' });
    }
    if (value.budgeted === 'true' && value.unbudgeted === 'true') {
      context.addIssue({ code: 'custom', message: 'budgeted and unbudgeted cannot both be true' });
    }
    if (value.uncategorizedOnly === 'true' && value.unbudgeted !== 'true') {
      context.addIssue({
        code: 'custom',
        message: 'uncategorizedOnly requires unbudgeted=true',
      });
    }
    if (
      value.minAmount !== undefined &&
      value.maxAmount !== undefined &&
      value.minAmount > value.maxAmount
    ) {
      context.addIssue({ code: 'custom', message: 'minAmount cannot exceed maxAmount' });
    }
  });

const transactionInclude = {
  tags: {
    include: { tag: { select: { id: true, name: true, color: true, isSource: true } } },
  },
} satisfies Prisma.TransactionInclude;

export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }

  const query = parsed.data;
  const responseLimit = query.limit;
  const where: Prisma.TransactionWhereInput = { archived: query.archived === 'true' };

  if (query.start && query.end) {
    where.date = {
      gte: new Date(`${query.start}T00:00:00.000Z`),
      lte: new Date(`${query.end}T23:59:59.999Z`),
    };
  }
  if (query.search) where.name = { contains: query.search };

  const tagIds = query.tagIds
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (query.tagId) where.tags = { some: { tagId: query.tagId } };
  else if (tagIds?.length) where.tags = { some: { tagId: { in: tagIds } } };
  if (query.untaggedOnly === 'true') where.tags = { none: { tag: { isSource: false } } };

  if (query.type === 'debit') where.debit = { gt: 0 };
  if (query.type === 'credit') where.credit = { gt: 0 };
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    const amount = {
      ...(query.minAmount !== undefined && { gte: toCents(query.minAmount) }),
      ...(query.maxAmount !== undefined && { lte: toCents(query.maxAmount) }),
      gt: 0,
    };
    where.OR = [{ debit: amount }, { credit: amount }];
  }

  const needsBudgetFilter = query.budgeted === 'true' || query.unbudgeted === 'true';
  if (needsBudgetFilter) {
    where.debit = { gt: 0 };
    const [transactions, budgets, lines, tags, untrackedCategories] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy: { date: 'desc' },
        take: 10_001,
      }),
      prisma.budget.findMany({ orderBy: { startDate: 'asc' } }),
      prisma.budgetLine.findMany({
        select: { budgetId: true, tags: { select: { tag: { select: { id: true } } } } },
      }),
      prisma.tag.findMany({ select: { id: true, parentId: true } }),
      query.uncategorizedOnly === 'true'
        ? prisma.untrackedCategory.findMany({
            select: { year: true, tags: { select: { tagId: true } } },
          })
        : Promise.resolve([]),
    ]);
    if (transactions.length > 10_000) {
      return NextResponse.json(
        { error: 'Too many matching transactions; narrow the filters or date range' },
        { status: 413 },
      );
    }
    const childrenMap = buildChildrenMap(tags);
    const coveredByBudget = buildCoveredTagsByBudget(lines, childrenMap);
    const untrackedCategoryTagIdsByYear = new Map<number, Set<string>>();
    for (const category of untrackedCategories) {
      const tagIds = untrackedCategoryTagIdsByYear.get(category.year) ?? new Set<string>();
      for (const tagId of collectDescendantTagIds(
        category.tags.map((tag) => tag.tagId),
        childrenMap,
      )) {
        tagIds.add(tagId);
      }
      untrackedCategoryTagIdsByYear.set(category.year, tagIds);
    }
    const filtered = transactions.filter((transaction) => {
      const budget = findApplicableBudget(budgets, transaction.date);
      const covered = budget
        ? (coveredByBudget.get(budget.id) ?? new Set<string>())
        : new Set<string>();
      const tagIds = getNonSourceTagIds(transaction.tags.map((entry) => entry.tag));
      const tracked = isFullyTracked(tagIds, covered);
      if (
        query.uncategorizedOnly === 'true' &&
        tagIds.some((tagId) =>
          untrackedCategoryTagIdsByYear.get(transaction.date.getUTCFullYear())?.has(tagId),
        )
      ) {
        return false;
      }
      return query.budgeted === 'true' ? tracked : !tracked;
    });
    const startIndex = (query.page - 1) * responseLimit;
    const pageData = filtered.slice(startIndex, startIndex + responseLimit);
    return NextResponse.json({
      data: pageData.map(transactionWithTagsFromCents),
      total: filtered.length,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(filtered.length / responseLimit)),
    });
  }

  const page = query.page;
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: { date: 'desc' },
      skip: (page - 1) * responseLimit,
      take: responseLimit,
    }),
    prisma.transaction.count({ where }),
  ]);
  return NextResponse.json({
    data: transactions.map(transactionWithTagsFromCents),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / responseLimit)),
  });
}
