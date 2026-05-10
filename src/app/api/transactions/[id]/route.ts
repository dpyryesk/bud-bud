import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/transactions/:id - Update transaction notes and/or archived status
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { notes, archived } = body;

  const data: Record<string, unknown> = {};
  if (notes !== undefined) data.notes = notes ?? '';
  if (archived !== undefined) {
    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 });
    }
    data.archived = archived;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const transaction = await prisma.transaction.update({
      where: { id },
      data,
    });

    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }
}
