import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/dashboard - Dashboard summary stats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  const dateFilter = {
    date: {
      gte: new Date(start),
      lte: new Date(end),
    },
    archived: false,
  };

  const transactions = await prisma.transaction.findMany({
    where: dateFilter,
    include: {
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, isSource: true } },
        },
      },
    },
  });

  const totalIncome = transactions.reduce((sum, t) => sum + t.credit, 0);
  const totalSpending = transactions.reduce((sum, t) => sum + t.debit, 0);
  const net = totalIncome - totalSpending;
  const count = transactions.length;

  // Spending by tag (non-source only)
  const tagSpending: Record<string, { name: string; color: string; amount: number }> = {};
  for (const tx of transactions) {
    const nonSourceTags = tx.tags.filter((tt) => !tt.tag.isSource);
    if (nonSourceTags.length === 0) {
      const key = 'untagged';
      if (!tagSpending[key]) tagSpending[key] = { name: 'Untagged', color: '#9CA3AF', amount: 0 };
      tagSpending[key].amount += tx.debit;
    } else {
      for (const tt of nonSourceTags) {
        if (!tagSpending[tt.tag.id]) {
          tagSpending[tt.tag.id] = { name: tt.tag.name, color: tt.tag.color, amount: 0 };
        }
        tagSpending[tt.tag.id].amount += tx.debit / nonSourceTags.length;
      }
    }
  }

  const spendingByTag = Object.values(tagSpending)
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    totalIncome,
    totalSpending,
    net,
    count,
    spendingByTag,
  });
}
