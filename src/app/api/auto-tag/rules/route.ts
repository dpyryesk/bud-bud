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

// GET /api/auto-tag/rules - List auto-tag rules
export async function GET() {
  const rules = await prisma.autoTagRule.findMany({
    include: {
      tag: { select: { id: true, name: true, color: true, isSource: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(rules);
}

// POST /api/auto-tag/rules - Create auto-tag rule
export async function POST(request: NextRequest) {
  const body = await request.json();
  const pattern = String(body?.pattern ?? '').trim();
  const rawMatchType = body?.matchType;
  const tagId = String(body?.tagId ?? '');
  const applyNow = Boolean(body?.applyNow);

  if (!pattern || !rawMatchType || !tagId) {
    return NextResponse.json(
      { error: 'pattern, matchType, and tagId are required' },
      { status: 400 },
    );
  }

  if (!VALID_MATCH_TYPES.includes(rawMatchType as MatchType)) {
    return NextResponse.json({ error: 'matchType must be "exact" or "regex"' }, { status: 400 });
  }

  const matchType = rawMatchType as MatchType;

  // Validate regex if matchType is regex
  if (matchType === 'regex') {
    try {
      new RegExp(pattern);
    } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const rule = await tx.autoTagRule.create({
      data: {
        pattern,
        matchType,
        tagId,
      },
      include: {
        tag: { select: { id: true, name: true, color: true, isSource: true } },
      },
    });

    if (!applyNow) {
      return {
        rule,
        matchedCount: 0,
      };
    }

    const transactions = await tx.transaction.findMany({
      select: {
        id: true,
        normalizedName: true,
        tags: {
          select: {
            tagId: true,
          },
        },
      },
    });

    const matchingIds = transactions
      .filter((t) => matchesPattern(t.normalizedName, pattern, matchType))
      .filter((t) => t.tags.every((tt) => tt.tagId !== tagId))
      .map((t) => t.id);

    if (matchingIds.length > 0) {
      await tx.transactionTag.createMany({
        data: matchingIds.map((transactionId) => ({ transactionId, tagId })),
      });
    }

    return {
      rule,
      matchedCount: matchingIds.length,
    };
  });

  if (!applyNow) {
    return NextResponse.json(result.rule, { status: 201 });
  }

  return NextResponse.json(
    {
      ...result.rule,
      applied: {
        matched: result.matchedCount,
      },
    },
    { status: 201 },
  );
}
