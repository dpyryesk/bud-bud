import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInputAsUtc } from '@/lib/date-utils';

// GET /api/budgets - List all budgets ordered by startDate asc, with counts and validUntil
export async function GET() {
  const budgets = await prisma.budget.findMany({
    orderBy: { startDate: 'asc' },
    include: {
      _count: { select: { categories: true, lines: true } },
    },
  });

  const result = budgets.map((budget, index) => ({
    id: budget.id,
    startDate: budget.startDate.toISOString(),
    resetRollover: budget.resetRollover,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    categoryCount: budget._count.categories,
    lineCount: budget._count.lines,
    validUntil: index < budgets.length - 1 ? budgets[index + 1].startDate.toISOString() : null,
  }));

  return NextResponse.json(result);
}

// POST /api/budgets - Create a new budget
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { startDate, resetRollover = false } = body;

  if (!startDate || typeof startDate !== 'string') {
    return NextResponse.json({ error: 'startDate is required' }, { status: 400 });
  }

  const parsedDate = parseDateInputAsUtc(startDate);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'startDate is not a valid date' }, { status: 400 });
  }

  const existing = await prisma.budget.findFirst({
    where: { startDate: parsedDate },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'A budget with this startDate already exists' },
      { status: 409 },
    );
  }

  let budget;
  try {
    budget = await prisma.budget.create({
      data: {
        startDate: parsedDate,
        resetRollover: typeof resetRollover === 'boolean' ? resetRollover : false,
      },
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

  return NextResponse.json(
    {
      id: budget.id,
      startDate: budget.startDate.toISOString(),
      resetRollover: budget.resetRollover,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
