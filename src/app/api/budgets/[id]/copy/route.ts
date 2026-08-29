import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInputAsUtc } from '@/lib/date-utils';
import { dateOnlySchema, readJson } from '@/lib/api-validation';
import { z } from 'zod';

const copySchema = z
  .object({ startDate: dateOnlySchema, resetRollover: z.boolean().optional() })
  .strict();

// POST /api/budgets/:id/copy - Copy a budget to a new startDate
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request, copySchema);
  if (!body.success) return body.response;
  const { startDate, resetRollover } = body.data;

  const parsedDate = parseDateInputAsUtc(startDate);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'startDate is not a valid date' }, { status: 400 });
  }

  // Fetch source budget with all categories, lines, line tags, and income sources
  const source = await prisma.budget.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: { order: 'asc' },
      },
      lines: {
        orderBy: { order: 'asc' },
        include: {
          tags: true,
        },
      },
      incomeSources: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!source) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  // Check for duplicate startDate
  const duplicate = await prisma.budget.findFirst({ where: { startDate: parsedDate } });
  if (duplicate) {
    return NextResponse.json(
      { error: 'A budget with this startDate already exists' },
      { status: 409 },
    );
  }

  let newBudget;
  try {
    newBudget = await prisma.$transaction(async (tx) => {
      // 1. Create new Budget
      const budget = await tx.budget.create({
        data: {
          startDate: parsedDate,
          resetRollover: typeof resetRollover === 'boolean' ? resetRollover : source.resetRollover,
        },
      });

      // 2. Create categories and build old→new id map
      const categoryIdMap = new Map<string, string>();
      for (const cat of source.categories) {
        const newCat = await tx.budgetCategory.create({
          data: {
            name: cat.name,
            order: cat.order,
            budgetId: budget.id,
          },
        });
        categoryIdMap.set(cat.id, newCat.id);
      }

      // 3. Create lines and build old→new line id map
      const lineIdMap = new Map<string, string>();
      for (const line of source.lines) {
        const newLine = await tx.budgetLine.create({
          data: {
            name: line.name,
            period: line.period,
            amount: line.amount,
            rollover: line.rollover,
            order: line.order,
            budgetId: budget.id,
            categoryId: line.categoryId ? (categoryIdMap.get(line.categoryId) ?? null) : null,
          },
        });
        lineIdMap.set(line.id, newLine.id);
      }

      // 4. Create BudgetLineTags pointing to new line ids
      for (const line of source.lines) {
        const newLineId = lineIdMap.get(line.id);
        if (!newLineId) continue;
        for (const tag of line.tags) {
          await tx.budgetLineTag.create({
            data: {
              budgetLineId: newLineId,
              tagId: tag.tagId,
            },
          });
        }
      }

      // 5. Create income sources for the new budget
      for (const incomeSource of source.incomeSources) {
        await tx.incomeSource.create({
          data: {
            budgetId: budget.id,
            name: incomeSource.name,
            netAmount: incomeSource.netAmount,
            netPeriod: incomeSource.netPeriod,
            grossAmount: incomeSource.grossAmount,
            grossPeriod: incomeSource.grossPeriod,
            order: incomeSource.order,
          },
        });
      }

      return budget;
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'A budget with this startDate already exists' },
        { status: 409 },
      );
    }
    throw e;
  }

  // Fetch counts and compute validUntil
  const [counts, allBudgets] = await Promise.all([
    prisma.budget.findUnique({
      where: { id: newBudget.id },
      include: { _count: { select: { categories: true, lines: true } } },
    }),
    prisma.budget.findMany({
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true },
    }),
  ]);

  const index = allBudgets.findIndex((b) => b.id === newBudget.id);
  const nextBudget = index >= 0 && index < allBudgets.length - 1 ? allBudgets[index + 1] : null;

  return NextResponse.json(
    {
      id: newBudget.id,
      startDate: newBudget.startDate.toISOString(),
      resetRollover: newBudget.resetRollover,
      createdAt: newBudget.createdAt.toISOString(),
      updatedAt: newBudget.updatedAt.toISOString(),
      categoryCount: counts?._count.categories ?? 0,
      lineCount: counts?._count.lines ?? 0,
      validUntil: nextBudget ? nextBudget.startDate.toISOString() : null,
    },
    { status: 201 },
  );
}
