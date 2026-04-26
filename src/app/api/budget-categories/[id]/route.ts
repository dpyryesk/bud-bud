import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/budget-categories/:id - Update a budget category name
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const category = await prisma.budgetCategory.update({
      where: { id },
      data: { name: name.trim() },
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: 'Budget category not found' }, { status: 404 });
  }
}

// DELETE /api/budget-categories/:id - Delete a budget category (unassigns budget lines)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Unassign all budget lines in this category before deleting
    await prisma.budgetLine.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    await prisma.budgetCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Budget category not found' }, { status: 404 });
  }
}
