import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget-lines?budgetId=... - List budget lines for a specific budget
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const budgetId = searchParams.get('budgetId');

  if (!budgetId) {
    return NextResponse.json({ error: 'budgetId query param is required' }, { status: 400 });
  }

  const budgetLines = await prisma.budgetLine.findMany({
    where: { budgetId },
    include: {
      tags: {
        include: {
          tag: {
            select: { id: true, name: true, color: true, isSource: true },
          },
        },
      },
    },
    orderBy: [{ categoryId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  });

  const formatted = budgetLines.map((bl) => ({
    id: bl.id,
    name: bl.name,
    period: bl.period,
    amount: bl.amount,
    rollover: bl.rollover,
    order: bl.order,
    categoryId: bl.categoryId,
    tags: bl.tags.map((blt) => blt.tag),
  }));

  return NextResponse.json(formatted);
}

// POST /api/budget-lines - Create a new budget line
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, period, amount, rollover, tagIds, categoryId, budgetId } = body;

  if (!name || !period || amount === undefined) {
    return NextResponse.json({ error: 'name, period, and amount are required' }, { status: 400 });
  }

  if (!budgetId) {
    return NextResponse.json({ error: 'budgetId is required' }, { status: 400 });
  }

  const budgetExists = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budgetExists) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  const resolvedBudgetId: string = budgetId;

  if (categoryId) {
    const category = await prisma.budgetCategory.findUnique({
      where: { id: categoryId },
      select: { budgetId: true },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (category.budgetId !== resolvedBudgetId) {
      return NextResponse.json(
        { error: 'Category does not belong to selected budget' },
        { status: 400 },
      );
    }
  }

  // Assign order as max + 1 within the category (or globally if uncategorized)
  const maxOrder = await prisma.budgetLine.aggregate({
    where: {
      budgetId: resolvedBudgetId,
      categoryId: categoryId ?? null,
    },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const budgetLine = await prisma.budgetLine.create({
    data: {
      name,
      period,
      amount: parseFloat(amount),
      rollover: rollover || false,
      order,
      budgetId: resolvedBudgetId,
      categoryId: categoryId ?? null,
      tags: {
        create: (tagIds || []).map((tagId: string) => ({ tagId })),
      },
    },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
  });

  return NextResponse.json(
    {
      id: budgetLine.id,
      name: budgetLine.name,
      period: budgetLine.period,
      amount: budgetLine.amount,
      rollover: budgetLine.rollover,
      order: budgetLine.order,
      categoryId: budgetLine.categoryId,
      tags: budgetLine.tags.map((blt) => blt.tag),
    },
    { status: 201 },
  );
}
