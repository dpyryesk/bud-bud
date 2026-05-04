import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectDescendantTagIds } from '@/lib/tag-tree';

// GET /api/untracked-categories?budgetId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const budgetId = searchParams.get('budgetId');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!budgetId || !start || !end) {
    return NextResponse.json({ error: 'budgetId, start, and end are required' }, { status: 400 });
  }

  const periodStart = new Date(start);
  const periodEndMidnight = new Date(end);
  const periodEnd = new Date(
    Date.UTC(
      periodEndMidnight.getUTCFullYear(),
      periodEndMidnight.getUTCMonth(),
      periodEndMidnight.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  // Load budget lines, untracked categories, and all tags in parallel
  const [budgetLines, untrackedCategories, allTags] = await Promise.all([
    prisma.budgetLine.findMany({
      where: { budgetId },
      include: {
        tags: { include: { tag: { select: { id: true } } } },
      },
    }),
    prisma.untrackedCategory.findMany({
      where: { budgetId },
      orderBy: { order: 'asc' },
      include: {
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, isSource: true, parentId: true } },
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

  // Build expanded tag sets for every budget line (allBudgetTagIds)
  const allBudgetTagIds = new Set<string>();
  for (const bl of budgetLines) {
    const directTagIds = bl.tags.map((blt) => blt.tag.id);
    const expanded = collectDescendantTagIds(directTagIds, childrenMap);
    for (const id of expanded) {
      allBudgetTagIds.add(id);
    }
  }

  // Build expanded tag sets for each untracked category
  const categoryExpandedTagIds: { categoryId: string; tagIds: Set<string> }[] =
    untrackedCategories.map((cat) => {
      const directTagIds = cat.tags.map((ct) => ct.tag.id);
      return {
        categoryId: cat.id,
        tagIds: collectDescendantTagIds(directTagIds, childrenMap),
      };
    });

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

  // Filter to transactions not covered by any budget line ("untracked" transactions)
  const untrackedTransactions = transactions.filter((tx) => {
    const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);
    return nonSourceTagIds.length === 0 || !nonSourceTagIds.some((id) => allBudgetTagIds.has(id));
  });

  // For each untracked category, find matching transactions and compute spending
  const categorySpending = new Map<string, number>();
  const matchedTransactionIds = new Set<string>();

  for (const { categoryId, tagIds } of categoryExpandedTagIds) {
    let spending = 0;
    for (const tx of untrackedTransactions) {
      const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);
      if (nonSourceTagIds.some((id) => tagIds.has(id))) {
        spending += tx.debit;
        matchedTransactionIds.add(tx.id);
      }
    }
    categorySpending.set(categoryId, spending);
  }

  // "Truly uncategorized" transactions = untracked and not matched by any category
  const trulyUncategorizedTransactions = untrackedTransactions.filter(
    (tx) => !matchedTransactionIds.has(tx.id),
  );
  const totalTrulyUncategorized = trulyUncategorizedTransactions.reduce(
    (sum, tx) => sum + tx.debit,
    0,
  );

  const formatTx = (t: (typeof untrackedTransactions)[number]) => ({
    id: t.id,
    date: t.date.toISOString(),
    name: t.name,
    normalizedName: t.normalizedName,
    debit: t.debit,
    credit: t.credit,
    source: t.source,
    notes: t.notes,
    tags: t.tags.map((tt) => tt.tag),
  });

  const categories = untrackedCategories.map((cat) => ({
    id: cat.id,
    budgetId: cat.budgetId,
    name: cat.name,
    order: cat.order,
    tags: cat.tags.map((ct) => ({
      id: ct.tag.id,
      name: ct.tag.name,
      color: ct.tag.color,
      isSource: ct.tag.isSource,
      parentId: ct.tag.parentId,
    })),
    actualSpending: categorySpending.get(cat.id) ?? 0,
  }));

  return NextResponse.json({
    categories,
    totalTrulyUncategorized,
    trulyUncategorizedTransactions: trulyUncategorizedTransactions.map(formatTx),
  });
}

// POST /api/untracked-categories
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { budgetId, name, tagIds, order } = body;

  if (!budgetId || !name) {
    return NextResponse.json({ error: 'budgetId and name are required' }, { status: 400 });
  }

  const category = await prisma.untrackedCategory.create({
    data: {
      budgetId,
      name,
      order: order ?? 0,
      tags: {
        create: (tagIds ?? []).map((tagId: string) => ({ tagId })),
      },
    },
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true, parentId: true } },
        },
      },
    },
  });

  return NextResponse.json(
    {
      id: category.id,
      budgetId: category.budgetId,
      name: category.name,
      order: category.order,
      tags: category.tags.map((ct) => ct.tag),
    },
    { status: 201 },
  );
}
