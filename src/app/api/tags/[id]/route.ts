import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { colorSchema, idSchema, nameSchema, readJson } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    color: colorSchema.optional(),
    parentId: idSchema.nullable().optional(),
    isSource: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  const result = await prisma.$transaction(async (tx) => {
    const [tag, allTags] = await Promise.all([
      tx.tag.findUnique({ where: { id } }),
      tx.tag.findMany({ select: { id: true, parentId: true, isSource: true } }),
    ]);
    if (!tag) return { kind: 'missing' as const };
    if (body.data.isSource !== undefined && body.data.isSource !== tag.isSource) {
      return { kind: 'immutable-type' as const };
    }
    if (body.data.parentId !== undefined && body.data.parentId !== tag.parentId) {
      const byParent = new Map<string, string[]>();
      for (const candidate of allTags) {
        if (!candidate.parentId) continue;
        byParent.set(candidate.parentId, [
          ...(byParent.get(candidate.parentId) ?? []),
          candidate.id,
        ]);
      }
      const descendants = new Set<string>([id]);
      const queue = [id];
      while (queue.length) {
        for (const child of byParent.get(queue.shift()!) ?? []) {
          if (!descendants.has(child)) {
            descendants.add(child);
            queue.push(child);
          }
        }
      }
      if (body.data.parentId && descendants.has(body.data.parentId))
        return { kind: 'cycle' as const };
      const parent = body.data.parentId
        ? allTags.find((candidate) => candidate.id === body.data.parentId)
        : null;
      if (body.data.parentId && !parent) return { kind: 'missing-parent' as const };
      if (parent && parent.isSource !== tag.isSource) return { kind: 'type-mismatch' as const };
      const maximum = await tx.tag.aggregate({
        where: { parentId: body.data.parentId ?? null },
        _max: { order: true },
      });
      return {
        kind: 'ok' as const,
        tag: await tx.tag.update({
          where: { id },
          data: {
            ...(body.data.name !== undefined && { name: body.data.name }),
            ...(body.data.color !== undefined && { color: body.data.color }),
            parentId: body.data.parentId,
            order: (maximum._max.order ?? -1) + 1,
          },
        }),
      };
    }
    return {
      kind: 'ok' as const,
      tag: await tx.tag.update({
        where: { id },
        data: {
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.color !== undefined && { color: body.data.color }),
        },
      }),
    };
  });
  const errors = {
    missing: ['Tag not found', 404],
    'immutable-type': ['Tag type cannot be changed after creation', 409],
    cycle: ['Cannot set a descendant as parent', 422],
    'missing-parent': ['Parent tag not found', 404],
    'type-mismatch': ['Parent and child tags must have the same type', 400],
  } as const;
  if (result.kind !== 'ok') {
    const [error, status] = errors[result.kind];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result.tag);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = await prisma.$transaction(async (tx) => {
    const tag = await tx.tag.findUnique({ where: { id }, include: { children: true } });
    if (!tag) return false;
    const maximum = await tx.tag.aggregate({
      where: { parentId: tag.parentId },
      _max: { order: true },
    });
    for (const [offset, child] of tag.children.sort((a, b) => a.order - b.order).entries()) {
      await tx.tag.update({
        where: { id: child.id },
        data: { parentId: tag.parentId, order: (maximum._max.order ?? -1) + 1 + offset },
      });
    }
    await tx.tag.delete({ where: { id } });
    return true;
  });
  return deleted
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Tag not found' }, { status: 404 });
}
