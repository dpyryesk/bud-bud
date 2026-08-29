import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nameSchema, readJson } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request, z.object({ name: nameSchema }).strict());
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      await prisma.budgetCategory.update({ where: { id }, data: { name: body.data.name } }),
    );
  } catch {
    return NextResponse.json({ error: 'Budget category not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await prisma.$transaction(async (tx) => {
    const category = await tx.budgetCategory.findUnique({ where: { id }, select: { id: true } });
    if (!category) return false;
    await tx.budgetLine.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await tx.budgetCategory.delete({ where: { id } });
    return true;
  });
  return found
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Budget category not found' }, { status: 404 });
}
