import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { idSchema, nameSchema, readJson } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({ name: nameSchema, budgetId: idSchema }).strict();

export async function GET(request: NextRequest) {
  const budgetId = idSchema.safeParse(request.nextUrl.searchParams.get('budgetId'));
  if (!budgetId.success) {
    return NextResponse.json({ error: 'budgetId query param is required' }, { status: 400 });
  }
  return NextResponse.json(
    await prisma.budgetCategory.findMany({
      where: { budgetId: budgetId.data },
      orderBy: { order: 'asc' },
    }),
  );
}

export async function POST(request: NextRequest) {
  const body = await readJson(request, createSchema);
  if (!body.success) return body.response;
  const result = await prisma.$transaction(async (tx) => {
    const budget = await tx.budget.findUnique({
      where: { id: body.data.budgetId },
      select: { id: true },
    });
    if (!budget) return null;
    const maximum = await tx.budgetCategory.aggregate({
      where: { budgetId: body.data.budgetId },
      _max: { order: true },
    });
    return tx.budgetCategory.create({
      data: {
        name: body.data.name,
        budgetId: body.data.budgetId,
        order: (maximum._max.order ?? -1) + 1,
      },
    });
  });
  return result
    ? NextResponse.json(result, { status: 201 })
    : NextResponse.json({ error: 'Budget not found' }, { status: 404 });
}
