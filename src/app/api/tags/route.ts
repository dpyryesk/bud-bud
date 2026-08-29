import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { colorSchema, idSchema, nameSchema, readJson } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

const createSchema = z
  .object({
    name: nameSchema,
    color: colorSchema.default('#6B7280'),
    parentId: idSchema.nullable().optional(),
    isSource: z.boolean().default(false),
  })
  .strict();

export async function GET() {
  return NextResponse.json(
    await prisma.tag.findMany({
      include: { children: { select: { id: true } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
  );
}

export async function POST(request: NextRequest) {
  const body = await readJson(request, createSchema);
  if (!body.success) return body.response;
  const result = await prisma.$transaction(async (tx) => {
    if (body.data.parentId) {
      const parent = await tx.tag.findUnique({
        where: { id: body.data.parentId },
        select: { isSource: true },
      });
      if (!parent) return { kind: 'missing-parent' as const };
      if (parent.isSource !== body.data.isSource) return { kind: 'type-mismatch' as const };
    }
    const maximum = await tx.tag.aggregate({
      where: { parentId: body.data.parentId ?? null },
      _max: { order: true },
    });
    return {
      kind: 'ok' as const,
      tag: await tx.tag.create({
        data: {
          name: body.data.name,
          color: body.data.color,
          parentId: body.data.parentId ?? null,
          isSource: body.data.isSource,
          order: (maximum._max.order ?? -1) + 1,
        },
      }),
    };
  });
  if (result.kind === 'missing-parent')
    return NextResponse.json({ error: 'Parent tag not found' }, { status: 404 });
  if (result.kind === 'type-mismatch')
    return NextResponse.json(
      { error: 'Parent and child tags must have the same type' },
      { status: 400 },
    );
  return NextResponse.json(result.tag, { status: 201 });
}
