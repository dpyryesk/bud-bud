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
    archived: t.archived,
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
  const nolimit = searchParams.get('nolimit') === 'true';
  const tagId = searchParams.get('tagId');
  const tagIdsParam = searchParams.get('tagIds');
  const untaggedOnly = searchParams.get('untaggedOnly') === 'true';
  const unbudgeted = searchParams.get('unbudgeted') === 'true';
  const budgeted = searchParams.get('budgeted') === 'true';
  const type = searchParams.get('type'); // 'debit' | 'credit'
  const search = searchParams.get('search')?.trim() ?? '';
  const minAmountVal = parseFloat(searchParams.get('minAmount') ?? '');
  const maxAmountVal = parseFloat(searchParams.get('maxAmount') ?? '');
  // archived=true → show only archived; default → show only non-archived
  const archivedParam = searchParams.get('archived');
  const archivedFilter = archivedParam === 'true' ? true : false;

  if (!Number.isInteger(rawPage) || !Number.isInteger(rawLimit)) {
    return NextResponse.json({ error: 'page and limit must be integers' }, { status: 400 });
  }

  const page = Math.max(1, rawPage);
  const limit = nolimit ? Number.MAX_SAFE_INTEGER : Math.min(200, Math.max(1, rawLimit));

  const where: Record<string, unknown> = { archived: archivedFilter };

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
  } else if (tagIdsParam) {
    const tagIds = tagIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (tagIds.length > 0) {
      where.tags = {
        some: { tagId: { in: tagIds } },
      };
    }
  }

  if (untaggedOnly) {
    where.tags = {
      none: {
        tag: { isSource: false },
      },
    };
  }

  // ---- Transaction type filter (debit-only or credit-only) ----
  if (type === 'debit') {
    where.debit = { gt: 0 };
  } else if (type === 'credit') {
    where.credit = { gt: 0 };
  }

  // ---- Amount range filter ----
  if (!Number.isNaN(minAmountVal) || !Number.isNaN(maxAmountVal)) {
    const debitCond: Record<string, number> = { gt: 0 };
    const creditCond: Record<string, number> = { gt: 0 };
    if (!Number.isNaN(minAmountVal)) {
      debitCond.gte = minAmountVal;
      creditCond.gte = minAmountVal;
    }
    if (!Number.isNaN(maxAmountVal)) {
      debitCond.lte = maxAmountVal;
      creditCond.lte = maxAmountVal;
    }
    where.OR = [{ debit: debitCond }, { credit: creditCond }];
  }

  // ---- Budget-line filters (in-memory, debit transactions only) ----
  // Both `unbudgeted` and `budgeted` require loading budget lines to determine coverage.
  if (unbudgeted && budgeted) {
    return NextResponse.json(
      { error: 'budgeted and unbudgeted cannot both be true' },
      { status: 400 },
    );
  }
  if (unbudgeted || budgeted) {
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

    const filtered = unbudgeted
      ? allTxs.filter((tx) => {
          const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);
          return (
            nonSourceTagIds.length === 0 || !nonSourceTagIds.some((id) => coveredTagIds.has(id))
          );
        })
      : allTxs.filter((tx) => {
          // budgeted=true: keep only transactions covered by at least one budget line tag
          const nonSourceTagIds = tx.tags.filter((tt) => !tt.tag.isSource).map((tt) => tt.tag.id);
          return nonSourceTagIds.length > 0 && nonSourceTagIds.some((id) => coveredTagIds.has(id));
        });

    const total = filtered.length;
    const paginated = nolimit ? filtered : filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      data: paginated.map(formatTransaction),
      total,
      page,
      totalPages: nolimit ? 1 : Math.ceil(total / limit) || 1,
    });
  }

  // ---- Standard path ----
  if (nolimit) {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true, isSource: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions.map(formatTransaction),
      total,
      page: 1,
      totalPages: 1,
    });
  }

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
