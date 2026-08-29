import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fromCents } from '@/lib/money';
import { z } from 'zod';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// GET /api/dashboard/monthly-trend?year=2026
// Returns 12 data points with income and spending totals per month.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resultYear = z.coerce
    .number()
    .int()
    .min(1900)
    .max(2200)
    .safeParse(searchParams.get('year'));
  if (!resultYear.success) {
    return NextResponse.json({ error: 'year is required and must be a number' }, { status: 400 });
  }
  const year = resultYear.data;

  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      archived: false,
    },
    select: { date: true, credit: true, debit: true },
  });

  const byMonth: { income: number; spending: number }[] = Array.from({ length: 12 }, () => ({
    income: 0,
    spending: 0,
  }));

  for (const tx of transactions) {
    const month = new Date(tx.date).getUTCMonth();
    byMonth[month].income += tx.credit;
    byMonth[month].spending += tx.debit;
  }

  const result = MONTH_LABELS.map((month, i) => ({
    month,
    income: fromCents(byMonth[i].income),
    spending: fromCents(byMonth[i].spending),
  }));

  return NextResponse.json(result);
}
