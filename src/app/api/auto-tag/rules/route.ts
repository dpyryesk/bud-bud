import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/auto-tag/rules - List auto-tag rules
export async function GET() {
  const rules = await prisma.autoTagRule.findMany({
    include: {
      tag: { select: { id: true, name: true, color: true, isSource: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(rules);
}

// POST /api/auto-tag/rules - Create auto-tag rule
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pattern, matchType, tagId } = body;

  if (!pattern || !matchType || !tagId) {
    return NextResponse.json(
      { error: 'pattern, matchType, and tagId are required' },
      { status: 400 },
    );
  }

  // Validate regex if matchType is regex
  if (matchType === 'regex') {
    try {
      new RegExp(pattern);
    } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
    }
  }

  const rule = await prisma.autoTagRule.create({
    data: {
      pattern,
      matchType,
      tagId,
    },
    include: {
      tag: { select: { id: true, name: true, color: true, isSource: true } },
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
