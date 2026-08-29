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

const updateBudgetLineSchema = z
  .object({
    name: nameSchema.optional(),
    period: budgetPeriodSchema.optional(),
    amount: nonNegativeMoneyInputSchema.optional(),
    rollover: z.boolean().optional(),
    tagIds: tagIdsSchema.optional(),
    categoryId: idSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const tagSelect = { id: true, name: true, color: true, isSource: true } as const;

function formatLine<
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const line = await prisma.budgetLine.findUnique({
    where: { id },
    include: { tags: { include: { tag: { select: tagSelect } } } },
  });
  return line
    ? NextResponse.json(formatLine(line))
    : NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readJson(request, updateBudgetLineSchema);
  if (!parsed.success) return parsed.response;
  const updates = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.budgetLine.findUnique({
        where: { id },
        select: { budgetId: true, categoryId: true },
      });
      if (!existing) throw new RouteError('Budget line not found', 404);

      const hasCategoryId = Object.hasOwn(updates, 'categoryId');
      const nextCategoryId = hasCategoryId ? (updates.categoryId ?? null) : existing.categoryId;
      if (nextCategoryId) {
        const category = await tx.budgetCategory.findUnique({
          where: { id: nextCategoryId },
          select: { budgetId: true },
        });
        if (!category || category.budgetId !== existing.budgetId) {
          throw new RouteError('Category does not belong to the budget line budget', 400);
        }
      }

      if (updates.tagIds) {
        const validTagCount = await tx.tag.count({
          where: { id: { in: updates.tagIds }, isSource: false },
        });
        if (validTagCount !== updates.tagIds.length) {
          throw new RouteError('All budget-line tags must be existing category tags', 400);
        }
      }

      let nextOrder: number | undefined;
      if (hasCategoryId && existing.categoryId !== nextCategoryId) {
        const maxOrder = await tx.budgetLine.aggregate({
          where: { budgetId: existing.budgetId, categoryId: nextCategoryId },
          _max: { order: true },
        });
        nextOrder = (maxOrder._max.order ?? -1) + 1;
      }

      await tx.budgetLine.update({
        where: { id },
        data: {
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.period !== undefined && { period: updates.period }),
          ...(updates.amount !== undefined && { amount: toCents(updates.amount) }),
          ...(updates.rollover !== undefined && { rollover: updates.rollover }),
          ...(hasCategoryId && { categoryId: nextCategoryId }),
          ...(nextOrder !== undefined && { order: nextOrder }),
        },
      });

      if (updates.tagIds) {
        await tx.budgetLineTag.deleteMany({ where: { budgetLineId: id } });
        if (updates.tagIds.length > 0) {
          await tx.budgetLineTag.createMany({
            data: updates.tagIds.map((tagId) => ({ budgetLineId: id, tagId })),
          });
        }
      }

      return tx.budgetLine.findUniqueOrThrow({
        where: { id },
        include: { tags: { include: { tag: { select: tagSelect } } } },
      });
    });
    return NextResponse.json(formatLine(result));
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to update budget line' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.budgetLine.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to delete budget line' }, { status: 500 });
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
