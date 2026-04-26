import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectDescendantTagIds } from '@/lib/tag-tree';

type RawTransaction = Awaited<ReturnType<typeof fetchAllMatching>>[number];

async function fetchAllMatching(where: Record<string, unknown>) {
  return prisma.transaction.findMany({
    where,
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  });
}

function formatTransaction(t: RawTransaction) {
  return {
    id: t.id,
    date: t.date.toISOString(),
    name: t.name,
    normalizedName: t.normalizedName,
    debit: t.debit,
    credit: t.credit,
    source: t.source,
    notes: t.notes,
    tags: t.tags.map((tt) => tt.tag),
  };
}

// GET /api/transactions - List transactions with period filter, search, and pagination
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const tagId = searchParams.get('tagId');
  const untaggedOnly = searchParams.get('untaggedOnly') === 'true';
  const unbudgeted = searchParams.get('unbudgeted') === 'true';
  const search = searchParams.get('search')?.trim() ?? '';

  if (!Number.isInteger(rawPage) || !Number.isInteger(rawLimit)) {
    return NextResponse.json({ error: 'page and limit must be integers' }, { status: 400 });
  }

  const page = Math.max(1, rawPage);
  const limit = Math.min(200, Math.max(1, rawLimit));

  const where: Record<string, unknown> = {};

  if (start && end) {
    where.date = {
      gte: new Date(start),
      lte: new Date(end),
    };
  }

  if (search) {
    where.name = { contains: search };
  }

  if (tagId) {
    where.tags = {
      some: { tagId },
    };
  }

  if (untaggedOnly) {
    where.tags = {
      none: {
        tag: { isSource: false },
      },
    };
  }

  // ---- Unbudgeted filter: transactions not covered by any budget line ----
  // Cannot be expressed as a Prisma WHERE clause, so we fetch all matching rows
  // and filter in memory (data is bounded to a single period).
  // Constrained to debit transactions only, consistent with /api/budget/untracked.
  if (unbudgeted) {
    where.debit = { gt: 0 };

    const [budgetLines, allTags] = await Promise.all([
      prisma.budgetLine.findMany({
        include: { tags: { include: { tag: { select: { id: true } } } } },
      }),
      prisma.tag.findMany({ select: { id: true, parentId: true } }),
    ]);

    const childrenMap = new Map<string, string[]>();
    for (const tag of allTags) {
      if (tag.parentId) {
        const existing = childrenMap.get(tag.parentId) ?? [];
        existing.push(tag.id);
        childrenMap.set(tag.parentId, existing);
      }
    }

    const coveredTagIds = new Set<string>();
    for (const bl of budgetLines) {
      const directTagIds = bl.tags.map((blt) => blt.tag.id);
      const expanded = collectDescendantTagIds(directTagIds, childrenMap);
      for (const id of expanded) {
        coveredTagIds.add(id);
      }
    }

    const allTxs = await fetchAllMatching(where);

    const filtered = allTxs.filter((tx) => {
      const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);
      return nonSourceTagIds.length === 0 || !nonSourceTagIds.some((id) => coveredTagIds.has(id));
    });

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      data: paginated.map(formatTransaction),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  }

  // ---- Standard path ----
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true, isSource: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    data: transactions.map(formatTransaction),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  });
}
