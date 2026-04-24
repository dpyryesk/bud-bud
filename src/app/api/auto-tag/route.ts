import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/auto-tag - Run auto-tagging on untagged transactions
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const dateFilter: Record<string, unknown> = {};
  if (start && end) {
    dateFilter.date = {
      gte: new Date(start),
      lte: new Date(end),
    };
  }

  // Find transactions that have NO non-source tags
  const untaggedTransactions = await prisma.transaction.findMany({
    where: {
      ...dateFilter,
      tags: {
        none: {
          tag: { isSource: false },
        },
      },
    },
    include: {
      tags: {
        include: { tag: true },
      },
    },
  });

  let tagged = 0;
  let skipped = 0;

  // Load auto-tag rules
  const rules = await prisma.autoTagRule.findMany({
    include: { tag: true },
  });

  for (const transaction of untaggedTransactions) {
    // Strategy 1: Find previously tagged transactions with same normalized name
    const existingTagged = await prisma.transaction.findFirst({
      where: {
        normalizedName: transaction.normalizedName,
        id: { not: transaction.id },
        tags: {
          some: {
            tag: { isSource: false },
          },
        },
      },
      include: {
        tags: {
          include: { tag: true },
          where: {
            tag: { isSource: false },
          },
        },
      },
    });

    if (existingTagged && existingTagged.tags.length > 0) {
      // Copy non-source tags from the matched transaction
      for (const tt of existingTagged.tags) {
        await prisma.transactionTag.upsert({
          where: {
            transactionId_tagId: {
              transactionId: transaction.id,
              tagId: tt.tagId,
            },
          },
          create: {
            transactionId: transaction.id,
            tagId: tt.tagId,
          },
          update: {},
        });
      }
      tagged++;
      continue;
    }

    // Strategy 2: Check auto-tag rules
    let ruleMatched = false;
    for (const rule of rules) {
      let matches = false;
      if (rule.matchType === 'exact') {
        matches = transaction.normalizedName === rule.pattern.toLowerCase();
      } else if (rule.matchType === 'regex') {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          matches = regex.test(transaction.normalizedName);
        } catch {
          // Invalid regex, skip
        }
      }

      if (matches) {
        await prisma.transactionTag.upsert({
          where: {
            transactionId_tagId: {
              transactionId: transaction.id,
              tagId: rule.tagId,
            },
          },
          create: {
            transactionId: transaction.id,
            tagId: rule.tagId,
          },
          update: {},
        });
        ruleMatched = true;
      }
    }

    if (ruleMatched) {
      tagged++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    total: untaggedTransactions.length,
    tagged,
    skipped,
  });
}
