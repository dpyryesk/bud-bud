import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transactionWithTagsFromCents } from '@/lib/api-formatters';
import { idSchema, readJson, tagIdsSchema } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

const tagBodySchema = z.object({ tagIds: tagIdsSchema }).strict();
const singleTagBodySchema = z.object({ tagId: idSchema }).strict();
const includeTags = {
  tags: {
    include: { tag: { select: { id: true, name: true, color: true, isSource: true } } },
  },
} as const;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readJson(request, singleTagBodySchema);
  if (!body.success) return body.response;
  const transaction = await prisma.$transaction(async (tx) => {
    const exists = await tx.transaction.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return null;
    await tx.transactionTag.deleteMany({ where: { transactionId: id, tagId: body.data.tagId } });
    return tx.transaction.findUnique({ where: { id }, include: includeTags });
  });
  return transaction
    ? NextResponse.json(transactionWithTagsFromCents(transaction))
    : NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request, tagBodySchema);
  if (!body.success) return body.response;
  const transaction = await prisma.$transaction(async (tx) => {
    const [exists, tags] = await Promise.all([
      tx.transaction.findUnique({ where: { id }, select: { id: true } }),
      tx.tag.findMany({
        where: { id: { in: body.data.tagIds }, isSource: false },
        select: { id: true },
      }),
    ]);
    if (!exists) return { kind: 'missing' as const };
    if (tags.length !== body.data.tagIds.length) return { kind: 'invalid-tags' as const };
    await tx.transactionTag.deleteMany({
      where: { transactionId: id, tag: { isSource: false } },
    });
    if (tags.length) {
      await tx.transactionTag.createMany({
        data: tags.map((tag) => ({ transactionId: id, tagId: tag.id })),
      });
    }
    return {
      kind: 'ok' as const,
      value: await tx.transaction.findUniqueOrThrow({ where: { id }, include: includeTags }),
    };
  });
  if (transaction.kind === 'missing') {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }
  if (transaction.kind === 'invalid-tags') {
    return NextResponse.json({ error: 'All tagIds must reference category tags' }, { status: 400 });
  }
  return NextResponse.json(transactionWithTagsFromCents(transaction.value));
}
