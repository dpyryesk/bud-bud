import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { readJson } from '@/lib/api-validation';
import { savedCsvMappingSchema } from '@/lib/csv-mapping-validation';
import { prisma } from '@/lib/prisma';

function deserializeSourceValueTagMap(value: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.values(parsed).every((tagId) => typeof tagId === 'string')
    ) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Treat legacy or malformed persisted values as unmapped.
  }
  return {};
}

async function sourceTagsAreValid(
  sourceTagId: string | null,
  sourceValueTagMap: Record<string, string>,
) {
  const tagIds = [
    ...new Set(
      [sourceTagId, ...Object.values(sourceValueTagMap)].filter(
        (tagId): tagId is string => tagId !== null,
      ),
    ),
  ];
  if (tagIds.length === 0) return true;
  const count = await prisma.tag.count({ where: { id: { in: tagIds }, isSource: true } });
  return count === tagIds.length;
}

export async function GET() {
  const mappings = await prisma.csvMapping.findMany({
    include: { sourceTag: { select: { id: true, name: true, color: true, isSource: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(
    mappings.map(({ sourceValueTagMap, ...mapping }) => ({
      ...mapping,
      sourceValueTagMap: deserializeSourceValueTagMap(sourceValueTagMap),
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await readJson(request, savedCsvMappingSchema);
  if (!body.success) return body.response;
  if (!(await sourceTagsAreValid(body.data.sourceTagId, body.data.sourceValueTagMap))) {
    return NextResponse.json(
      { error: 'Every configured source tag must exist and be a source tag' },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await prisma.csvMapping.create({
        data: {
          ...body.data,
          sourceValueTagMap: JSON.stringify(body.data.sourceValueTagMap),
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
