import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Collect all descendant IDs of a tag to prevent circular parent assignment. */
async function getDescendantIds(tagId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const queue = [tagId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ids.add(current);
    const children = await prisma.tag.findMany({
      where: { parentId: current },
      select: { id: true },
    });
    for (const child of children) {
      if (!ids.has(child.id)) {
        queue.push(child.id);
      }
    }
  }

  return ids;
}

// PUT /api/tags/:id - Update a tag
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, color, parentId, isSource } = body;

  // Guard against circular parent assignments
  if (parentId) {
    const descendants = await getDescendantIds(id);
    if (descendants.has(parentId)) {
      return NextResponse.json(
        { error: 'Cannot set a descendant as parent (circular reference)' },
        { status: 422 },
      );
    }
  }

  try {
    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(isSource !== undefined && { isSource }),
      },
    });

    return NextResponse.json(tag);
  } catch {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }
}

// DELETE /api/tags/:id - Delete a tag; children are re-parented to its parent
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const tag = await prisma.tag.findUnique({
      where: { id },
      include: { children: true },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Reassign children to the deleted tag's parent (or to root if it was a root tag)
    if (tag.children.length > 0) {
      await prisma.tag.updateMany({
        where: { parentId: id },
        data: { parentId: tag.parentId },
      });
    }

    await prisma.tag.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}
