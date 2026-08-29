import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { incomeSourceMoneyFromCents } from '@/lib/api-formatters';
import {
  budgetPeriodSchema,
  idSchema,
  nameSchema,
  nonNegativeMoneyInputSchema,
  orderSchema,
  readJson,
} from '@/lib/api-validation';
import { toCents } from '@/lib/money';
import { prisma } from '@/lib/prisma';

const createIncomeSourceSchema = z
  .object({
    budgetId: idSchema,
    name: nameSchema,
    netAmount: nonNegativeMoneyInputSchema,
    netPeriod: budgetPeriodSchema,
    grossAmount: nonNegativeMoneyInputSchema.nullable().optional(),
    grossPeriod: budgetPeriodSchema.nullable().optional(),
    order: orderSchema.optional(),
  })
  .refine(
    (value) => value.grossAmount == null || value.grossPeriod != null,
    'grossPeriod is required when grossAmount is provided',
  );

export async function GET(request: NextRequest) {
  const budgetId = request.nextUrl.searchParams.get('budgetId');
  if (!budgetId) {
    return NextResponse.json({ error: 'budgetId is required' }, { status: 400 });
  }
  const sources = await prisma.incomeSource.findMany({
    where: { budgetId },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(sources.map(incomeSourceMoneyFromCents));
}

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, createIncomeSourceSchema);
  if (!parsed.success) return parsed.response;
  const value = parsed.data;

  try {
    const source = await prisma.$transaction(async (tx) => {
      const budget = await tx.budget.findUnique({
        where: { id: value.budgetId },
        select: { id: true },
      });
      if (!budget) throw new RouteError('Budget not found', 404);

      const order =
        value.order ??
        ((
          await tx.incomeSource.aggregate({
            where: { budgetId: value.budgetId },
            _max: { order: true },
          })
        )._max.order ?? -1) + 1;
      return tx.incomeSource.create({
        data: {
          budgetId: value.budgetId,
          name: value.name,
          netAmount: toCents(value.netAmount),
          netPeriod: value.netPeriod,
          grossAmount: value.grossAmount == null ? null : toCents(value.grossAmount),
          grossPeriod: value.grossAmount == null ? null : value.grossPeriod,
          order,
        },
      });
    });
    return NextResponse.json(incomeSourceMoneyFromCents(source), { status: 201 });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to create income source' }, { status: 500 });
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
