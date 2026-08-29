import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { dateOnlySchema, readJson } from '@/lib/api-validation';
import { parseDateInputAsUtc } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';

const createBudgetSchema = z.object({
  startDate: dateOnlySchema,
  resetRollover: z.boolean().default(false),
});

export async function GET() {
  const budgets = await prisma.budget.findMany({
    orderBy: { startDate: 'asc' },
    include: { _count: { select: { categories: true, lines: true } } },
  });
  return NextResponse.json(
    budgets.map((budget, index) => ({
      id: budget.id,
      startDate: budget.startDate.toISOString(),
      resetRollover: budget.resetRollover,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
      categoryCount: budget._count.categories,
      lineCount: budget._count.lines,
      validUntil: budgets[index + 1]?.startDate.toISOString() ?? null,
    })),
  );
}

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, createBudgetSchema);
  if (!parsed.success) return parsed.response;
  try {
    const budget = await prisma.budget.create({
      data: {
        startDate: parseDateInputAsUtc(parsed.data.startDate),
        resetRollover: parsed.data.resetRollover,
      },
    });
    return NextResponse.json(
      {
        ...budget,
        startDate: budget.startDate.toISOString(),
        createdAt: budget.createdAt.toISOString(),
        updatedAt: budget.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A budget with this startDate already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Unable to create budget' }, { status: 500 });
  }
}
