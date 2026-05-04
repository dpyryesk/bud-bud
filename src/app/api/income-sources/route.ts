import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/income-sources?budgetId=...
export async function GET(request: NextRequest) {
  const budgetId = request.nextUrl.searchParams.get('budgetId');
  if (!budgetId) {
    return NextResponse.json({ error: 'budgetId is required' }, { status: 400 });
  }
  const sources = await prisma.incomeSource.findMany({
    where: { budgetId },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(sources);
}

// POST /api/income-sources
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { budgetId, name, netAmount, netPeriod, grossAmount, grossPeriod, order } = body;
  if (!budgetId || !name || netAmount == null || !netPeriod) {
    return NextResponse.json(
      { error: 'budgetId, name, netAmount, netPeriod are required' },
      { status: 400 },
    );
  }
  const source = await prisma.incomeSource.create({
    data: {
      budgetId,
      name,
      netAmount: Number(netAmount),
      netPeriod,
      grossAmount: grossAmount != null ? Number(grossAmount) : null,
      grossPeriod: grossPeriod ?? null,
      order: order ?? 0,
    },
  });
  return NextResponse.json(source, { status: 201 });
}
