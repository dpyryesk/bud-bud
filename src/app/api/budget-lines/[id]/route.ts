import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget-lines/:id - Fetch a single budget line
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const budgetLine = await prisma.budgetLine.findUnique({
    where: { id },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
  });

  if (!budgetLine) {
    return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: budgetLine.id,
    name: budgetLine.name,
    period: budgetLine.period,
    amount: budgetLine.amount,
    rollover: budgetLine.rollover,
    order: budgetLine.order,
    categoryId: budgetLine.categoryId,
    tags: budgetLine.tags.map((blt) => blt.tag),
  });
}

// PUT /api/budget-lines/:id - Update a budget line
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, period, amount, rollover, tagIds, categoryId } = body;

  try {
    const existing = await prisma.budgetLine.findUnique({
      where: { id },
      select: { categoryId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
    }

    const hasCategoryId = Object.prototype.hasOwnProperty.call(body, 'categoryId');
    const nextCategoryId = hasCategoryId ? (categoryId ?? null) : existing.categoryId;

    let nextOrder: number | undefined;
    if (hasCategoryId && existing.categoryId !== nextCategoryId) {
      // If moved between categories, append to the end of destination category
      const maxOrder = await prisma.budgetLine.aggregate({
        where: { categoryId: nextCategoryId },
        _max: { order: true },
      });
      nextOrder = (maxOrder._max.order ?? -1) + 1;
    }

    // Update budget line
    await prisma.budgetLine.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(period !== undefined && { period }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(rollover !== undefined && { rollover }),
        // Allow setting categoryId to null explicitly
        ...(hasCategoryId && { categoryId: nextCategoryId }),
        ...(nextOrder !== undefined && { order: nextOrder }),
      },
    });

    // Update tags if provided
    if (tagIds !== undefined) {
      await prisma.budgetLineTag.deleteMany({ where: { budgetLineId: id } });
      if (tagIds.length > 0) {
        await prisma.budgetLineTag.createMany({
          data: tagIds.map((tagId: string) => ({ budgetLineId: id, tagId })),
        });
      }
    }

    // Return with tags
    const result = await prisma.budgetLine.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, isSource: true } },
          },
        },
      },
    });

    return NextResponse.json({
      id: result?.id,
      name: result?.name,
      period: result?.period,
      amount: result?.amount,
      rollover: result?.rollover,
      order: result?.order,
      categoryId: result?.categoryId,
      tags: result?.tags.map((blt) => blt.tag) ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
  }
}

// DELETE /api/budget-lines/:id - Delete a budget line
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.budgetLine.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
  }
}
