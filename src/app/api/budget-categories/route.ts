import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget-categories - List all budget categories for a budget ordered by order field
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const budgetId = searchParams.get('budgetId');

  if (!budgetId) {
    return NextResponse.json({ error: 'budgetId query param is required' }, { status: 400 });
  }

  const categories = await prisma.budgetCategory.findMany({
    where: { budgetId },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(categories);
}

// POST /api/budget-categories - Create a new budget category
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, budgetId } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!budgetId || typeof budgetId !== 'string') {
    return NextResponse.json({ error: 'budgetId is required' }, { status: 400 });
  }

  const budgetExists = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budgetExists) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  const resolvedBudgetId = budgetId;

  // Assign order as max + 1 within the selected budget
  const maxOrder = await prisma.budgetCategory.aggregate({
    where: { budgetId: resolvedBudgetId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const category = await prisma.budgetCategory.create({
    data: { name: name.trim(), order, budgetId: resolvedBudgetId },
  });

  return NextResponse.json(category, { status: 201 });
}
