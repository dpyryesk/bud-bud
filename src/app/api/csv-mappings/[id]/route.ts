import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/csv-mappings/:id - Update a saved CSV mapping
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();
  const { name, dateColumn, nameColumn, debitColumn, creditColumn, sourceColumn, dateFormat, sourceTagId } = body;

  if (!name || !dateColumn || !nameColumn || !debitColumn || !creditColumn) {
    return NextResponse.json(
      { error: 'name, dateColumn, nameColumn, debitColumn, creditColumn are required' },
      { status: 400 },
    );
  }

  try {
    const mapping = await prisma.csvMapping.update({
      where: { id },
      data: {
        name,
        dateColumn,
        nameColumn,
        debitColumn,
        creditColumn,
        sourceColumn: sourceColumn && sourceColumn !== 'none' ? sourceColumn : '',
        dateFormat: dateFormat || 'YYYY-MM-DD',
        sourceTagId: sourceTagId && sourceTagId !== 'none' ? sourceTagId : null,
      },
    });

    return NextResponse.json(mapping);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

// DELETE /api/csv-mappings/:id - Delete a saved CSV mapping
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    await prisma.csvMapping.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
