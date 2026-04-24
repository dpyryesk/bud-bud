import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/tags/:id - Update a tag
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, color, parentId, isSource } = body;

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

// DELETE /api/tags/:id - Delete a tag (children get reassigned to parent)
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

    // Reassign children to parent
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
