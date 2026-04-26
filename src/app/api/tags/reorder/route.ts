import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/tags/reorder - Bulk update tag order values
// Body: { parentId: string | null; updates: [{ id: string; order: number }] }
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates =
    body && typeof body === 'object' && 'updates' in body
      ? (body as { updates: unknown }).updates
      : null;
  const parentId =
    body && typeof body === 'object' && 'parentId' in body
      ? (body as { parentId: unknown }).parentId
      : undefined;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
  }

  if (parentId !== null && parentId !== undefined && typeof parentId !== 'string') {
    return NextResponse.json({ error: 'parentId must be string or null' }, { status: 400 });
  }

  const validated = updates.map((item) => {
    if (!item || typeof item !== 'object') return null;

    const id = 'id' in item ? (item as { id: unknown }).id : undefined;
    const order = 'order' in item ? (item as { order: unknown }).order : undefined;

    if (typeof id !== 'string' || !Number.isInteger(order)) return null;

    return { id, order };
  });

  if (validated.some((item) => item === null)) {
    return NextResponse.json(
      { error: 'Each update must include a string id and integer order' },
      { status: 400 },
    );
  }

  const safeUpdates = validated.filter(
    (item): item is { id: string; order: number } => item !== null,
  );
  const ids = safeUpdates.map((item) => item.id);

  const tags = await prisma.tag.findMany({
    where: { id: { in: ids } },
    select: { id: true, parentId: true },
  });

  if (tags.length !== ids.length) {
    return NextResponse.json({ error: 'One or more tags not found' }, { status: 400 });
  }

  const normalizedParentId = parentId === undefined ? null : parentId;
  const hasMismatchedParent = tags.some((tag) => tag.parentId !== normalizedParentId);
  if (hasMismatchedParent) {
    return NextResponse.json(
      { error: 'All tags must belong to the provided parent' },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(
      safeUpdates.map(({ id, order }) => prisma.tag.update({ where: { id }, data: { order } })),
    );
  } catch {
    return NextResponse.json({ error: 'Failed to reorder tags' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
