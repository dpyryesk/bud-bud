import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { idSchema, matchTypeSchema, readJson, regexPatternSchema } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';
import { compileSafeRegex } from '@/lib/safe-regex';

const createSchema = z
  .object({
    pattern: regexPatternSchema,
    matchType: matchTypeSchema,
    tagId: idSchema,
    applyNow: z.boolean().default(false),
  })
  .strict();

export async function GET() {
  return NextResponse.json(
    await prisma.autoTagRule.findMany({
      include: { tag: { select: { id: true, name: true, color: true, isSource: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

export async function POST(request: NextRequest) {
  const body = await readJson(request, createSchema);
  if (!body.success) return body.response;
  let compiledRegex: ReturnType<typeof compileSafeRegex> | null = null;
  if (body.data.matchType === 'regex') {
    try {
      compiledRegex = compileSafeRegex(body.data.pattern);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid regex pattern' },
        { status: 400 },
      );
    }
  }
  const tag = await prisma.tag.findFirst({
    where: { id: body.data.tagId, isSource: false },
    select: { id: true },
  });
  if (!tag) return NextResponse.json({ error: 'Target must be a category tag' }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rule = await tx.autoTagRule.create({
        data: {
          pattern: body.data.pattern,
          matchType: body.data.matchType,
          tagId: body.data.tagId,
        },
        include: { tag: { select: { id: true, name: true, color: true, isSource: true } } },
      });
      if (!body.data.applyNow) return { rule, matchedCount: 0 };
      const transactions = await tx.transaction.findMany({
        select: { id: true, normalizedName: true, tags: { select: { tagId: true } } },
        take: 10_001,
      });
      if (transactions.length > 10_000)
        throw new RangeError('Too many transactions to apply at once');
      const matching = transactions.filter(
        (transaction) =>
          (body.data.matchType === 'exact'
            ? transaction.normalizedName.toLocaleLowerCase() ===
              body.data.pattern.toLocaleLowerCase()
            : compiledRegex!.test(transaction.normalizedName)) &&
          transaction.tags.every((entry) => entry.tagId !== body.data.tagId),
      );
      if (matching.length) {
        await tx.transactionTag.createMany({
          data: matching.map((transaction) => ({
            transactionId: transaction.id,
            tagId: body.data.tagId,
          })),
        });
      }
      return { rule, matchedCount: matching.length };
    });
    return NextResponse.json(
      body.data.applyNow
        ? { ...result.rule, applied: { matched: result.matchedCount } }
        : result.rule,
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create rule' },
      { status: error instanceof RangeError ? 413 : 400 },
    );
  }
}
