import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/tags - List all tags as flat list (with children info for tree building)
export async function GET() {
  const tags = await prisma.tag.findMany({
    include: {
      children: {
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(tags);
}

// POST /api/tags - Create a new tag
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, color, parentId, isSource } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const tag = await prisma.tag.create({
    data: {
      name: name.trim(),
      color: color || '#6B7280',
      parentId: parentId || null,
      isSource: isSource || false,
    },
  });

  return NextResponse.json(tag, { status: 201 });
}
