import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectDescendantTagIds } from '@/lib/tag-tree';

// GET /api/budget/untracked - Debit transactions not covered by any budget line
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  const periodStart = new Date(start);
  const periodEnd = new Date(end);

  // Load budget lines and all tags in parallel
  const [budgetLines, allTags] = await Promise.all([
    prisma.budgetLine.findMany({
      include: {
        tags: {
          include: {
            tag: { select: { id: true } },
          },
        },
      },
    }),
    prisma.tag.findMany({ select: { id: true, parentId: true } }),
  ]);

  // Build parent→children map
  const childrenMap = new Map<string, string[]>();
  for (const tag of allTags) {
    if (tag.parentId) {
      const existing = childrenMap.get(tag.parentId) ?? [];
      existing.push(tag.id);
      childrenMap.set(tag.parentId, existing);
    }
  }

  // Build expanded tag sets for every budget line
  const allBudgetTagIds = new Set<string>();
  for (const bl of budgetLines) {
    const directTagIds = bl.tags.map((blt) => blt.tag.id);
    const expanded = collectDescendantTagIds(directTagIds, childrenMap);
    for (const id of expanded) {
      allBudgetTagIds.add(id);
    }
  }

  // Load all debit transactions in the period with their tags
  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      debit: { gt: 0 },
    },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Filter to transactions not covered by any budget line
  const untrackedTransactions = transactions.filter((tx) => {
    const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);

    // Untracked if: no non-source tags, OR none of the non-source tags are in any budget line tag set
    return nonSourceTagIds.length === 0 || !nonSourceTagIds.some((id) => allBudgetTagIds.has(id));
  });

  const totalUntracked = untrackedTransactions.reduce((sum, tx) => sum + tx.debit, 0);

  const formatted = untrackedTransactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    name: t.name,
    normalizedName: t.normalizedName,
    debit: t.debit,
    credit: t.credit,
    source: t.source,
    notes: t.notes,
    tags: t.tags.map((tt) => tt.tag),
  }));

  return NextResponse.json({ totalUntracked, transactions: formatted });
}
