import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/budget-categories/reorder - Bulk update category order values
// Body: { updates: [{ id: string; order: number }] }
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

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
  }

  const validated = updates.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const id = 'id' in item ? (item as { id: unknown }).id : undefined;
    const order = 'order' in item ? (item as { order: unknown }).order : undefined;
    if (typeof id !== 'string' || !Number.isInteger(order)) return null;
    return { id, order: order as number };
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

  try {
    await prisma.$transaction(
      safeUpdates.map(({ id, order }) =>
        prisma.budgetCategory.update({ where: { id }, data: { order } }),
      ),
    );
  } catch {
    return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
