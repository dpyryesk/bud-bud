import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/auto-tag/rules/:id - Delete an auto-tag rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const rule = await prisma.autoTagRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  await prisma.autoTagRule.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
