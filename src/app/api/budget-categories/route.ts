import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget-categories - List all budget categories ordered by order field
export async function GET() {
  const categories = await prisma.budgetCategory.findMany({
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(categories);
}

// POST /api/budget-categories - Create a new budget category
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Assign order as max + 1
  const maxOrder = await prisma.budgetCategory.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  const category = await prisma.budgetCategory.create({
    data: { name: name.trim(), order },
  });

  return NextResponse.json(category, { status: 201 });
}
