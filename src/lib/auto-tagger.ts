import { prisma } from '@/lib/prisma';

export type AutoTagResult = {
  total: number;
  tagged: number;
  skipped: number;
};

/**
 * Run the auto-tagging engine on untagged transactions.
 *
 * Strategies applied in order for each transaction:
 * 1. Normalized-name match — copy non-source tags from a previously tagged
 *    transaction with the same normalizedName.
 * 2. AutoTagRule patterns — check exact/regex rules stored in the database.
 * 3. Unmatched — transaction remains untagged.
 *
 * @param start Optional start date for date-range filtering
 * @param end   Optional end date for date-range filtering
 */
export async function runAutoTag(start?: Date, end?: Date): Promise<AutoTagResult> {
  const dateFilter: Record<string, unknown> = {};
  if (start && end) {
    dateFilter.date = { gte: start, lte: end };
  }

  // Fetch all transactions that currently have no non-source tags
  const untaggedTransactions = await prisma.transaction.findMany({
    where: {
      ...dateFilter,
      tags: {
        none: {
          tag: { isSource: false },
        },
      },
    },
    select: {
      id: true,
      normalizedName: true,
    },
  });

  if (untaggedTransactions.length === 0) {
    return { total: 0, tagged: 0, skipped: 0 };
  }

  // Load all auto-tag rules up-front to avoid N+1 queries
  const rules = await prisma.autoTagRule.findMany({
    select: { id: true, pattern: true, matchType: true, tagId: true },
  });

  // Pre-compile regex patterns once
  const compiledRules = rules.map((rule) => {
    let regex: RegExp | null = null;
    if (rule.matchType === 'regex') {
      try {
        regex = new RegExp(rule.pattern, 'i');
      } catch {
        // Invalid pattern — will be skipped during matching
      }
    }
    return { ...rule, regex };
  });

  let tagged = 0;
  let skipped = 0;

  for (const transaction of untaggedTransactions) {
    // --- Strategy 1: Normalized-name lookup ---
    // NOTE: Skipped for now
    // const existingTagged = await prisma.transaction.findFirst({
    //   where: {
    //     normalizedName: transaction.normalizedName,
    //     id: { not: transaction.id },
    //     tags: {
    //       some: { tag: { isSource: false } },
    //     },
    //   },
    //   select: {
    //     tags: {
    //       where: { tag: { isSource: false } },
    //       select: { tagId: true },
    //     },
    //   },
    // });
    //
    // if (existingTagged && existingTagged.tags.length > 0) {
    //   for (const tt of existingTagged.tags) {
    //     await prisma.transactionTag.upsert({
    //       where: {
    //         transactionId_tagId: {
    //           transactionId: transaction.id,
    //           tagId: tt.tagId,
    //         },
    //       },
    //       create: { transactionId: transaction.id, tagId: tt.tagId },
    //       update: {},
    //     });
    //   }
    //   tagged++;
    //   continue;
    // }

    // --- Strategy 2: AutoTagRule patterns ---
    let ruleMatched = false;
    const normalizedLower = transaction.normalizedName.toLowerCase();

    for (const rule of compiledRules) {
      let matches = false;

      if (rule.matchType === 'exact') {
        matches = normalizedLower === rule.pattern.toLowerCase();
      } else if (rule.matchType === 'regex' && rule.regex) {
        matches = rule.regex.test(transaction.normalizedName);
      }

      if (matches) {
        await prisma.transactionTag.upsert({
          where: {
            transactionId_tagId: {
              transactionId: transaction.id,
              tagId: rule.tagId,
            },
          },
          create: { transactionId: transaction.id, tagId: rule.tagId },
          update: {},
        });
        ruleMatched = true;
        // Continue checking other rules so multiple tags can be applied
      }
    }

    if (ruleMatched) {
      tagged++;
    } else {
      skipped++;
    }
  }

  return { total: untaggedTransactions.length, tagged, skipped };
}
