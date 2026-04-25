import { NextRequest, NextResponse } from 'next/server';
import { runAutoTag } from '@/lib/auto-tagger';

// POST /api/auto-tag - Run auto-tagging on untagged transactions
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const start = startParam ? new Date(startParam) : undefined;
  const end = endParam ? new Date(endParam) : undefined;

  const result = await runAutoTag(start, end);
  return NextResponse.json(result);
}
