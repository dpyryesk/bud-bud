import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { dateOnlySchema, readJson } from '@/lib/api-validation';
import { parseDateInputAsUtc } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';

const updateBudgetSchema = z
  .object({
    startDate: dateOnlySchema.optional(),
    resetRollover: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

async function serializeBudget(id: string) {
  const [budget, allBudgets] = await Promise.all([
    prisma.budget.findUnique({
      where: { id },
      include: { _count: { select: { categories: true, lines: true } } },
    }),
    prisma.budget.findMany({
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true },
    }),
  ]);
  if (!budget) return null;
  const index = allBudgets.findIndex((candidate) => candidate.id === id);
  return {
    id: budget.id,
    startDate: budget.startDate.toISOString(),
    resetRollover: budget.resetRollover,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    categoryCount: budget._count.categories,
    lineCount: budget._count.lines,
    validUntil: allBudgets[index + 1]?.startDate.toISOString() ?? null,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await serializeBudget(id);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: 'Budget not found' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readJson(request, updateBudgetSchema);
  if (!parsed.success) return parsed.response;
  try {
    await prisma.budget.update({
      where: { id },
      data: {
        ...(parsed.data.startDate && {
          startDate: parseDateInputAsUtc(parsed.data.startDate),
        }),
        ...(parsed.data.resetRollover !== undefined && {
          resetRollover: parsed.data.resetRollover,
        }),
      },
    });
    return NextResponse.json(await serializeBudget(id));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A budget with this startDate already exists' },
          { status: 409 },
        );
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Unable to update budget' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const budgets = await tx.budget.findMany({ select: { id: true } });
      if (!budgets.some((budget) => budget.id === id))
        throw new RouteError('Budget not found', 404);
      if (budgets.length <= 1) throw new RouteError('Cannot delete the only budget', 409);
      await tx.budget.delete({ where: { id } });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to delete budget' }, { status: 500 });
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
