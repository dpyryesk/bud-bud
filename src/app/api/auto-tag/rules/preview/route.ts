import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type MatchType = 'exact' | 'regex';

const VALID_MATCH_TYPES: readonly MatchType[] = ['exact', 'regex'];

function matchesPattern(name: string, pattern: string, matchType: MatchType): boolean {
  if (matchType === 'exact') {
    return name.toLowerCase() === pattern.toLowerCase();
  }

  try {
    return new RegExp(pattern, 'i').test(name);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const pattern = String(body?.pattern ?? '').trim();
  const rawMatchType = body?.matchType ?? 'regex';

  if (!pattern) {
    return NextResponse.json({ tagged: [], taggedTotal: 0, untagged: [], untaggedTotal: 0 });
  }

  if (!VALID_MATCH_TYPES.includes(rawMatchType as MatchType)) {
    return NextResponse.json({ error: 'matchType must be "exact" or "regex"' }, { status: 400 });
  }

  const matchType = rawMatchType as MatchType;

  if (matchType === 'regex') {
    try {
      new RegExp(pattern, 'i');
    } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
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
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  const matching = transactions.filter((tx) =>
    matchesPattern(tx.normalizedName, pattern, matchType),
  );

  const taggedAll = matching.filter((tx) => tx.tags.some((tt) => !tt.tag.isSource));
  const untaggedAll = matching.filter((tx) => tx.tags.every((tt) => tt.tag.isSource));

  const toDisplay = (tx: (typeof transactions)[number]) => ({
    id: tx.id,
    date: tx.date.toISOString(),
    name: tx.name,
    debit: tx.debit,
    credit: tx.credit,
    tags: tx.tags.map((tt) => tt.tag),
  });

  return NextResponse.json({
    tagged: taggedAll.slice(0, 20).map(toDisplay),
    taggedTotal: taggedAll.length,
    untagged: untaggedAll.slice(0, 20).map(toDisplay),
    untaggedTotal: untaggedAll.length,
  });
}
