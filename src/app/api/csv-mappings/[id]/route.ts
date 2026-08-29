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
  const tagIds = [
    ...new Set(
      [body.data.sourceTagId, ...Object.values(body.data.sourceValueTagMap)].filter(
        (tagId): tagId is string => tagId !== null,
      ),
    ),
  ];
  if (
    tagIds.length > 0 &&
    (await prisma.tag.count({ where: { id: { in: tagIds }, isSource: true } })) !== tagIds.length
  ) {
    return NextResponse.json(
      { error: 'Every configured source tag must exist and be a source tag' },
      { status: 400 },
    );
  }
  try {
    const { sourceTagId, ...mappingData } = body.data;
    return NextResponse.json(
      await prisma.csvMapping.update({
        where: { id },
        data: {
          ...mappingData,
          sourceValueTagMap: JSON.stringify(body.data.sourceValueTagMap),
          sourceColumn: body.data.sourceColumn === 'none' ? '' : body.data.sourceColumn,
          debitColumn: body.data.debitColumn === 'none' ? '' : body.data.debitColumn,
          creditColumn: body.data.creditColumn === 'none' ? '' : body.data.creditColumn,
          sourceTag: sourceTagId ? { connect: { id: sourceTagId } } : { disconnect: true },
        },
      }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Mapping name already exists' }, { status: 409 });
    }
    console.error('Unable to update CSV mapping:', error);
    return NextResponse.json({ error: 'Unable to update mapping' }, { status: 400 });
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
