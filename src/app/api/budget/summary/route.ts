import { NextRequest, NextResponse } from 'next/server';
import { parseDateRange } from '@/lib/api-validation';
import { buildBudgetSummary } from '@/lib/budget-summary';

export async function GET(request: NextRequest) {
  const range = parseDateRange(request.nextUrl.searchParams);
  if (!range.success) return range.response;
  try {
    const summary = await buildBudgetSummary(range.start, range.end);
    return summary
      ? NextResponse.json(summary)
      : NextResponse.json({ error: 'No budgets found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Budget calculation failed' },
      { status: error instanceof RangeError ? 413 : 500 },
    );
  }
}
