import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInputAsUtc } from '@/lib/date-utils';

// GET /api/budgets/:id - Return a single budget by id
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [budget, allBudgets] = await Promise.all([
    prisma.budget.findUnique({
      where: { id },
      include: {
        _count: { select: { categories: true, lines: true } },
      },
    }),
    prisma.budget.findMany({
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true },
    }),
  ]);

  if (!budget) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  const index = allBudgets.findIndex((b) => b.id === id);
  const nextBudget = index >= 0 && index < allBudgets.length - 1 ? allBudgets[index + 1] : null;

  return NextResponse.json({
    id: budget.id,
    startDate: budget.startDate.toISOString(),
    resetRollover: budget.resetRollover,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    categoryCount: budget._count.categories,
    lineCount: budget._count.lines,
    validUntil: nextBudget ? nextBudget.startDate.toISOString() : null,
  });
}

// PUT /api/budgets/:id - Update a budget (startDate and/or resetRollover)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { startDate, resetRollover } = body;

  // Check the budget exists
  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  let parsedDate: Date | undefined;
  if (startDate !== undefined) {
    if (typeof startDate !== 'string') {
      return NextResponse.json({ error: 'startDate must be a string' }, { status: 400 });
    }
    parsedDate = parseDateInputAsUtc(startDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'startDate is not a valid date' }, { status: 400 });
    }

    // Check for duplicate startDate (excluding the budget being updated)
    const duplicate = await prisma.budget.findFirst({
      where: {
        startDate: parsedDate,
        id: { not: id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'A budget with this startDate already exists' },
        { status: 409 },
      );
    }
  }

  let updatedBudget;
  try {
    updatedBudget = await prisma.budget.update({
      where: { id },
      data: {
        ...(parsedDate !== undefined ? { startDate: parsedDate } : {}),
        ...(typeof resetRollover === 'boolean' ? { resetRollover } : {}),
      },
      include: {
        _count: { select: { categories: true, lines: true } },
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

  // Compute validUntil for the updated budget
  const allBudgets = await prisma.budget.findMany({
    orderBy: { startDate: 'asc' },
    select: { id: true, startDate: true },
  });
  const index = allBudgets.findIndex((b) => b.id === id);
  const nextBudget = index >= 0 && index < allBudgets.length - 1 ? allBudgets[index + 1] : null;

  return NextResponse.json({
    id: updatedBudget.id,
    startDate: updatedBudget.startDate.toISOString(),
    resetRollover: updatedBudget.resetRollover,
    createdAt: updatedBudget.createdAt.toISOString(),
    updatedAt: updatedBudget.updatedAt.toISOString(),
    categoryCount: updatedBudget._count.categories,
    lineCount: updatedBudget._count.lines,
    validUntil: nextBudget ? nextBudget.startDate.toISOString() : null,
  });
}

// DELETE /api/budgets/:id - Delete a budget (cascades to categories and lines)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Block delete if this is the only budget
  const totalCount = await prisma.budget.count();
  if (totalCount <= 1) {
    return NextResponse.json({ error: 'Cannot delete the only budget' }, { status: 409 });
  }

  try {
    await prisma.budget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }
}
