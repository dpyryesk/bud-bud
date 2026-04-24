import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/csv-mappings - List all saved CSV mappings
export async function GET() {
  const mappings = await prisma.csvMapping.findMany({
    include: {
      sourceTag: {
        select: { id: true, name: true, color: true, isSource: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(mappings);
}

// POST /api/csv-mappings - Create a new CSV mapping
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, dateColumn, nameColumn, debitColumn, creditColumn, sourceColumn, dateFormat, sourceTagId } = body;

  if (!name || !dateColumn || !nameColumn || !debitColumn || !creditColumn) {
    return NextResponse.json(
      { error: 'name, dateColumn, nameColumn, debitColumn, creditColumn are required' },
      { status: 400 },
    );
  }

  try {
    const mapping = await prisma.csvMapping.create({
      data: {
        name,
        dateColumn,
        nameColumn,
        debitColumn,
        creditColumn,
        sourceColumn: sourceColumn || '',
        dateFormat: dateFormat || 'YYYY-MM-DD',
        sourceTagId: sourceTagId || null,
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Mapping name already exists' }, { status: 409 });
  }
}
