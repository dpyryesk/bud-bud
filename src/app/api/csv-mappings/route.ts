import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { readJson } from '@/lib/api-validation';
import { savedCsvMappingSchema } from '@/lib/csv-mapping-validation';
import { prisma } from '@/lib/prisma';

export async function GET() {
  return NextResponse.json(
    await prisma.csvMapping.findMany({
      include: { sourceTag: { select: { id: true, name: true, color: true, isSource: true } } },
      orderBy: { name: 'asc' },
    }),
  );
}

export async function POST(request: NextRequest) {
  const body = await readJson(request, savedCsvMappingSchema);
  if (!body.success) return body.response;
  if (body.data.sourceTagId) {
    const sourceTag = await prisma.tag.findFirst({
      where: { id: body.data.sourceTagId, isSource: true },
      select: { id: true },
    });
    if (!sourceTag)
      return NextResponse.json(
        { error: 'sourceTagId must reference a source tag' },
        { status: 400 },
      );
  }
  try {
    return NextResponse.json(
      await prisma.csvMapping.create({
        data: {
          ...body.data,
          sourceColumn: body.data.sourceColumn === 'none' ? '' : body.data.sourceColumn,
          debitColumn: body.data.debitColumn === 'none' ? '' : body.data.debitColumn,
          creditColumn: body.data.creditColumn === 'none' ? '' : body.data.creditColumn,
        },
      }),
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
            ? 'Mapping name already exists'
            : 'Unable to create mapping',
      },
      {
        status:
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
            ? 409
            : 400,
      },
    );
  }
}
