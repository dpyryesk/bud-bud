import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  budgetPeriodSchema,
  idSchema,
  nameSchema,
  nonNegativeMoneyInputSchema,
  readJson,
  tagIdsSchema,
} from '@/lib/api-validation';
import { budgetLineMoneyFromCents } from '@/lib/api-formatters';
import { toCents } from '@/lib/money';

const createBudgetLineSchema = z.object({
  name: nameSchema,
  period: budgetPeriodSchema,
  amount: nonNegativeMoneyInputSchema,
  rollover: z.boolean().default(false),
  tagIds: tagIdsSchema.default([]),
  categoryId: idSchema.nullable().optional(),
  budgetId: idSchema,
});

const tagSelect = { id: true, name: true, color: true, isSource: true } as const;

function formatBudgetLine<
  T extends {
    amount: number;
    tags: Array<{ tag: { id: string; name: string; color: string; isSource: boolean } }>;
  },
>(line: T) {
  return {
    ...budgetLineMoneyFromCents(line),
    tags: line.tags.map((assignment) => assignment.tag),
  };
}

export async function GET(request: NextRequest) {
  const budgetId = request.nextUrl.searchParams.get('budgetId');
  if (!budgetId) {
    return NextResponse.json({ error: 'budgetId query param is required' }, { status: 400 });
  }

  const budgetLines = await prisma.budgetLine.findMany({
    where: { budgetId },
    include: { tags: { include: { tag: { select: tagSelect } } } },
    orderBy: [{ categoryId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(budgetLines.map(formatBudgetLine));
}

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, createBudgetLineSchema);
  if (!parsed.success) return parsed.response;
  const { name, period, amount, rollover, tagIds, categoryId, budgetId } = parsed.data;

  try {
    const budgetLine = await prisma.$transaction(async (tx) => {
      const [budget, category, validTagCount] = await Promise.all([
        tx.budget.findUnique({ where: { id: budgetId }, select: { id: true } }),
        categoryId
          ? tx.budgetCategory.findUnique({
              where: { id: categoryId },
              select: { budgetId: true },
            })
          : null,
        tx.tag.count({ where: { id: { in: tagIds }, isSource: false } }),
      ]);
      if (!budget) throw new RouteError('Budget not found', 404);
      if (categoryId && (!category || category.budgetId !== budgetId)) {
        throw new RouteError('Category does not belong to selected budget', 400);
      }
      if (validTagCount !== tagIds.length) {
        throw new RouteError('All budget-line tags must be existing category tags', 400);
      }

      const maxOrder = await tx.budgetLine.aggregate({
        where: { budgetId, categoryId: categoryId ?? null },
        _max: { order: true },
      });
      return tx.budgetLine.create({
        data: {
          name,
          period,
          amount: toCents(amount),
          rollover,
          order: (maxOrder._max.order ?? -1) + 1,
          budgetId,
          categoryId: categoryId ?? null,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
        include: { tags: { include: { tag: { select: tagSelect } } } },
      });
    });
    return NextResponse.json(formatBudgetLine(budgetLine), { status: 201 });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json({ error: 'Invalid related record' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to create budget line' }, { status: 500 });
  }
}

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
