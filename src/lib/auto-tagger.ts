import { prisma } from '@/lib/prisma';
import { compileSafeRegex } from '@/lib/safe-regex';

export type AutoTagResult = { total: number; tagged: number; skipped: number };

export async function runAutoTag(start?: Date, end?: Date): Promise<AutoTagResult> {
  const transactions = await prisma.transaction.findMany({
    where: {
      ...(start && end && { date: { gte: start, lte: end } }),
      archived: false,
      tags: { none: { tag: { isSource: false } } },
    },
    select: { id: true, normalizedName: true },
    take: 10_001,
  });
  if (!transactions.length) return { total: 0, tagged: 0, skipped: 0 };
  const rules = await prisma.autoTagRule.findMany({
    where: { tag: { isSource: false } },
    select: { pattern: true, matchType: true, tagId: true },
  });
  if (transactions.length > 10_000) {
    throw new RangeError('More than 10,000 transactions match; choose a narrower date range');
  }
  const compiled = rules.flatMap((rule) => {
    try {
      return [
        { ...rule, regex: rule.matchType === 'regex' ? compileSafeRegex(rule.pattern) : null },
      ];
    } catch {
      return [];
    }
  });
  const assignments = transactions.flatMap((transaction) =>
    compiled
      .filter((rule) =>
        rule.matchType === 'exact'
          ? transaction.normalizedName.toLocaleLowerCase() === rule.pattern.toLocaleLowerCase()
          : rule.regex!.test(transaction.normalizedName),
      )
      .map((rule) => ({ transactionId: transaction.id, tagId: rule.tagId })),
  );
  const uniqueAssignments = [
    ...new Map(assignments.map((item) => [`${item.transactionId}:${item.tagId}`, item])).values(),
  ];
  if (uniqueAssignments.length) await prisma.transactionTag.createMany({ data: uniqueAssignments });
  const taggedIds = new Set(uniqueAssignments.map((assignment) => assignment.transactionId));
  return {
    total: transactions.length,
    tagged: taggedIds.size,
    skipped: transactions.length - taggedIds.size,
  };
}
