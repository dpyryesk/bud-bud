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

  // Spending by tag (non-source only), considering debits and credits
  const tagSpending: Record<string, { id: string; name: string; color: string; spending: number }> =
    {};
  const sourceTagTotals: Record<
    string,
    { id: string; name: string; color: string; spending: number; income: number; total: number }
  > = {};

  for (const tx of transactions) {
    const netTxAmount = tx.debit - tx.credit;
    const txSpending = netTxAmount > 0 ? netTxAmount : 0;
    const txIncome = netTxAmount < 0 ? Math.abs(netTxAmount) : 0;

    const nonSourceTags = tx.tags.filter((tt) => !tt.tag.isSource);
    if (nonSourceTags.length === 0) {
      const key = 'untagged';
      if (!tagSpending[key]) {
        tagSpending[key] = {
          id: key,
          name: 'Untagged',
          color: '#9CA3AF',
          spending: 0,
        };
      }
      tagSpending[key].spending += txSpending;
    } else {
      for (const tt of nonSourceTags) {
        if (!tagSpending[tt.tag.id]) {
          tagSpending[tt.tag.id] = {
            id: tt.tag.id,
            name: tt.tag.name,
            color: tt.tag.color,
            spending: 0,
          };
        }
        tagSpending[tt.tag.id].spending += txSpending / nonSourceTags.length;
      }
    }

    const sourceTags = tx.tags.filter((tt) => tt.tag.isSource);
    if (sourceTags.length > 0) {
      for (const tt of sourceTags) {
        if (!sourceTagTotals[tt.tag.id]) {
          sourceTagTotals[tt.tag.id] = {
            id: tt.tag.id,
            name: tt.tag.name,
            color: tt.tag.color,
            spending: 0,
            income: 0,
            total: 0,
          };
        }

        sourceTagTotals[tt.tag.id].spending += txSpending / sourceTags.length;
        sourceTagTotals[tt.tag.id].income += txIncome / sourceTags.length;
        sourceTagTotals[tt.tag.id].total += netTxAmount / sourceTags.length;
      }
    }
  }

  const spendingByTag = Object.values(tagSpending)
    .filter((t) => t.spending > 0)
    .map((t) => ({ ...t, income: 0, total: t.spending }))
    .sort((a, b) => b.spending - a.spending);

  const sourceTagBreakdown = Object.values(sourceTagTotals).sort((a, b) => b.spending - a.spending);

  return NextResponse.json({
    totalIncome,
    totalSpending,
    net,
    count,
    spendingByTag,
    sourceTagTotals: sourceTagBreakdown,
  });
}
