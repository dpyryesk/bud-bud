import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

// PATCH /api/untracked-categories/[id]
// Updates: name, tagIds (replaces all tag associations), order
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, tagIds, order } = body;

  // Deduplicate tagIds to avoid unique-index violations
  const safeTagIds =
    tagIds !== undefined
      ? Array.isArray(tagIds)
        ? [...new Set((tagIds as unknown[]).filter((v): v is string => typeof v === 'string'))]
        : undefined
      : undefined;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // If tagIds is provided, atomically replace all tag associations
      if (safeTagIds !== undefined) {
        await tx.untrackedCategoryTag.deleteMany({ where: { untrackedCategoryId: id } });
        if (safeTagIds.length > 0) {
          await tx.untrackedCategoryTag.createMany({
            data: safeTagIds.map((tagId: string) => ({ untrackedCategoryId: id, tagId })),
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Untracked category not found' }, { status: 404 });
      }
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Duplicate tag assignment' }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'Unable to update untracked category' }, { status: 400 });
  }
}

// DELETE /api/untracked-categories/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.untrackedCategory.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Untracked category not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to delete untracked category' }, { status: 400 });
  }
}
