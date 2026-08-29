import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { readJson } from '@/lib/api-validation';
import { savedCsvMappingSchema } from '@/lib/csv-mapping-validation';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await readJson(request, savedCsvMappingSchema);
  if (!body.success) return body.response;
  if (body.data.sourceTagId) {
    const tag = await prisma.tag.findFirst({
      where: { id: body.data.sourceTagId, isSource: true },
      select: { id: true },
    });
    if (!tag)
      return NextResponse.json(
        { error: 'sourceTagId must reference a source tag' },
        { status: 400 },
      );
  }
  try {
    return NextResponse.json(
      await prisma.csvMapping.update({
        where: { id },
        data: {
          ...body.data,
          sourceColumn: body.data.sourceColumn === 'none' ? '' : body.data.sourceColumn,
          debitColumn: body.data.debitColumn === 'none' ? '' : body.data.debitColumn,
          creditColumn: body.data.creditColumn === 'none' ? '' : body.data.creditColumn,
        },
      }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Mapping name already exists' }, { status: 409 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    await prisma.csvMapping.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
  }
}
