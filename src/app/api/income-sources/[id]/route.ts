import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

// PATCH /api/income-sources/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, netAmount, netPeriod, grossAmount, grossPeriod, order } = body;

  try {
    const updated = await prisma.incomeSource.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(netAmount !== undefined && { netAmount: Number(netAmount) }),
        ...(netPeriod !== undefined && { netPeriod }),
        ...(grossAmount !== undefined && {
          grossAmount: grossAmount != null ? Number(grossAmount) : null,
        }),
        ...(grossPeriod !== undefined && { grossPeriod: grossPeriod ?? null }),
        ...(order !== undefined && { order }),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Income source not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to update income source' }, { status: 400 });
  }
}

// DELETE /api/income-sources/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.incomeSource.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Income source not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to delete income source' }, { status: 400 });
  }
}
