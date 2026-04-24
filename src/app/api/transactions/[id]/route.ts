import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/transactions/:id - Update transaction notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { notes } = body;

  try {
    const transaction = await prisma.transaction.update({
      where: { id },
      data: { notes: notes ?? '' },
    });

    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }
}
