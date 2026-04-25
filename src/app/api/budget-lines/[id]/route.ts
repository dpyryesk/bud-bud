import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget-lines/:id - Fetch a single budget line
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    ...budgetLine,
    tags: budgetLine.tags.map((blt) => blt.tag),
  });
}

// PUT /api/budget-lines/:id - Update a budget line
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, period, amount, rollover, tagIds } = body;

  try {
    // Update budget line
    const budgetLine = await prisma.budgetLine.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(period !== undefined && { period }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(rollover !== undefined && { rollover }),
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
      ...result,
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
