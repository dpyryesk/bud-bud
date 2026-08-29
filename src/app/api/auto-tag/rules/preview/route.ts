import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { matchTypeSchema, readJson, regexPatternSchema } from '@/lib/api-validation';
import { fromCents } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { compileSafeRegex } from '@/lib/safe-regex';

const previewSchema = z
  .object({ pattern: regexPatternSchema, matchType: matchTypeSchema.default('regex') })
  .strict();

export async function POST(request: NextRequest) {
  const body = await readJson(request, previewSchema);
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
  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      date: true,
      name: true,
      normalizedName: true,
      debit: true,
      credit: true,
      tags: { include: { tag: { select: { id: true, name: true, color: true, isSource: true } } } },
    },
    orderBy: { date: 'desc' },
    take: 10_001,
  });
  if (transactions.length > 10_000) {
    return NextResponse.json({ error: 'Too many transactions to preview' }, { status: 413 });
  }
  const matching = transactions.filter((transaction) =>
    body.data.matchType === 'exact'
      ? transaction.normalizedName.toLocaleLowerCase() === body.data.pattern.toLocaleLowerCase()
      : compiledRegex!.test(transaction.normalizedName),
  );
  const tagged = matching.filter((transaction) =>
    transaction.tags.some((entry) => !entry.tag.isSource),
  );
  const untagged = matching.filter((transaction) =>
    transaction.tags.every((entry) => entry.tag.isSource),
  );
  const format = (transaction: (typeof transactions)[number]) => ({
    id: transaction.id,
    date: transaction.date.toISOString(),
    name: transaction.name,
    debit: fromCents(transaction.debit),
    credit: fromCents(transaction.credit),
    tags: transaction.tags.map((entry) => entry.tag),
  });
  return NextResponse.json({
    tagged: tagged.slice(0, 20).map(format),
    taggedTotal: tagged.length,
    untagged: untagged.slice(0, 20).map(format),
    untaggedTotal: untagged.length,
  });
}
