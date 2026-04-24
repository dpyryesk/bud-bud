import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/transactions - List transactions with period filter and pagination
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const tagId = searchParams.get('tagId');
  const untaggedOnly = searchParams.get('untaggedOnly') === 'true';

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

  const formatted = transactions.map((t) => ({
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

  return NextResponse.json({
    data: formatted,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
