import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget-lines - List all budget lines
export async function GET() {
  const budgetLines = await prisma.budgetLine.findMany({
    include: {
      tags: {
        include: {
          tag: {
            select: { id: true, name: true, color: true, isSource: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formatted = budgetLines.map((bl) => ({
    id: bl.id,
    name: bl.name,
    period: bl.period,
    amount: bl.amount,
    rollover: bl.rollover,
    tags: bl.tags.map((blt) => blt.tag),
  }));

  return NextResponse.json(formatted);
}

// POST /api/budget-lines - Create a new budget line
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, period, amount, rollover, tagIds } = body;

  if (!name || !period || amount === undefined) {
    return NextResponse.json(
      { error: 'name, period, and amount are required' },
      { status: 400 },
    );
  }

  const budgetLine = await prisma.budgetLine.create({
    data: {
      name,
      period,
      amount: parseFloat(amount),
      rollover: rollover || false,
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
      ...budgetLine,
      tags: budgetLine.tags.map((blt) => blt.tag),
    },
    { status: 201 },
  );
}
