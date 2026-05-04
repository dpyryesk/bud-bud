import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/untracked-categories/[id]
// Updates: name, tagIds (replaces all tag associations), order
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, tagIds, order } = body;

  const updated = await prisma.$transaction(async (tx) => {
    // If tagIds is provided, atomically replace all tag associations
    if (tagIds !== undefined) {
      await tx.untrackedCategoryTag.deleteMany({ where: { untrackedCategoryId: id } });
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        await tx.untrackedCategoryTag.createMany({
          data: tagIds.map((tagId: string) => ({ untrackedCategoryId: id, tagId })),
        });
      }
    }

    return tx.untrackedCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(order !== undefined && { order }),
      },
      include: {
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true, isSource: true, parentId: true },
            },
          },
        },
      },
    });
  });

  return NextResponse.json({
    id: updated.id,
    budgetId: updated.budgetId,
    name: updated.name,
    order: updated.order,
    tags: updated.tags.map((ct) => ct.tag),
  });
}

// DELETE /api/untracked-categories/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.untrackedCategory.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
