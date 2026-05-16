import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/transactions/:id/tags - Remove a specific tag from a transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let tagId: string | undefined;
  try {
    const body = await request.json();
    tagId = (body as { tagId?: string }).tagId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!tagId) {
    return NextResponse.json({ error: 'tagId is required' }, { status: 400 });
  }

  try {
    await prisma.transactionTag.deleteMany({
      where: { transactionId: id, tagId },
    });

    const transaction = await prisma.transaction.findUnique({
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
      ...transaction,
      tags: transaction?.tags.map((tt) => tt.tag) ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
  }
}

// POST /api/transactions/:id/tags - Set tags for a transaction
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { tagIds } = body as { tagIds: string[] };

  if (!Array.isArray(tagIds)) {
    return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 });
  }

  // Deduplicate to avoid unique-constraint violations on (transactionId, tagId)
  const uniqueTagIds = [...new Set(tagIds)];

  try {
    // Remove existing non-source tags, keep source tags
    await prisma.transactionTag.deleteMany({
      where: {
        transactionId: id,
        tag: { isSource: false },
      },
    });

    // Add new tags
    if (uniqueTagIds.length > 0) {
      await prisma.transactionTag.createMany({
        data: uniqueTagIds.map((tagId) => ({
          transactionId: id,
          tagId,
        })),
      });
    }

    // Return updated transaction with tags
    const transaction = await prisma.transaction.findUnique({
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
      ...transaction,
      tags: transaction?.tags.map((tt) => tt.tag) ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
  }
}
