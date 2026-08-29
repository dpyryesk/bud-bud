import { NextRequest, NextResponse } from 'next/server';
import { runAutoTag } from '@/lib/auto-tagger';
import { parseDateRange } from '@/lib/api-validation';

// POST /api/auto-tag - Run auto-tagging on untagged transactions
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hasRange = searchParams.has('start') || searchParams.has('end');
  const range = hasRange ? parseDateRange(searchParams) : null;
  if (range && !range.success) return range.response;
  try {
    return NextResponse.json(
      await runAutoTag(
        range?.success ? range.start : undefined,
        range?.success ? range.end : undefined,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-tagging failed' },
      { status: error instanceof RangeError ? 413 : 500 },
    );
  }
}
