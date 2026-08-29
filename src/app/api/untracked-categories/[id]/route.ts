import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';
import { nameSchema, orderSchema, readJson, tagIdsSchema } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    tagIds: tagIdsSchema.optional(),
    order: orderSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (body.data.tagIds) {
        const tags = await tx.tag.findMany({
          where: { id: { in: body.data.tagIds }, isSource: false },
          select: { id: true },
        });
        if (tags.length !== body.data.tagIds.length)
          throw new TypeError('All tagIds must be category tags');
        await tx.untrackedCategoryTag.deleteMany({ where: { untrackedCategoryId: id } });
        if (tags.length) {
          await tx.untrackedCategoryTag.createMany({
            data: tags.map((tag) => ({ untrackedCategoryId: id, tagId: tag.id })),
          });
        }
      }
      return tx.untrackedCategory.update({
        where: { id },
        data: {
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.order !== undefined && { order: body.data.order }),
        },
        include: { tags: { include: { tag: true } } },
      });
    });
    return NextResponse.json({ ...updated, tags: updated.tags.map((entry) => entry.tag) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Untracked category not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update category' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.untrackedCategory.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Untracked category not found' },
      {
        status:
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
            ? 404
            : 400,
      },
    );
  }
}
