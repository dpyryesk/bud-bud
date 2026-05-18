import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectDescendantTagIds } from '@/lib/tag-tree';
import { getYearlyAmount, type BudgetPeriodType } from '@/lib/date-utils';
import type { Budget } from '@/generated/prisma/client';

/**
 * Return the latest budget whose startDate <= date.
 * Falls back to the earliest budget if none qualifies.
 * Assumes budgets is sorted by startDate asc.
 */
function findApplicableBudget(budgets: Budget[], date: Date): Budget | null {
  let applicable: Budget | null = null;
  for (const budget of budgets) {
    if (budget.startDate <= date) {
      applicable = budget;
    }
  }
  return applicable ?? budgets[0] ?? null;
}

// GET /api/app-health - Returns aggregated health/setup check data for the sidebar checklist card
export async function GET() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const yearEnd = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));

  // ── Parallel queries that don't depend on the active budget ──────────────
  const [tagCount, allBudgets, transactionCount, autoTagRuleCount, allTagsForTree] =
    await Promise.all([
      prisma.tag.count({ where: { isSource: false } }),
      prisma.budget.findMany({ orderBy: { startDate: 'asc' } }),
      prisma.transaction.count({ where: { archived: false } }),
      prisma.autoTagRule.count(),
      // Full tag list for building the parent→children map
      prisma.tag.findMany({ select: { id: true, parentId: true, isSource: true } }),
    ]);

  const hasBudget = allBudgets.length > 0;
  const activeBudget = hasBudget ? findApplicableBudget(allBudgets, now) : null;

  // ── Budget-dependent queries ─────────────────────────────────────────────
  let budgetLineCount = 0;
  let incomeSourceCount = 0;
  let yearlyBudget = 0;
  let yearlyIncome = 0;
  let budgetLineTags: { amount: number; period: string; tagIds: string[] }[] = [];
  // Raw tag IDs for each untracked category — expanded into Sets after childrenMap is built
  let untrackedCatRawTagIds: string[][] = [];

  if (activeBudget) {
    const [lines, incomeSources, untrackedCategories] = await Promise.all([
      prisma.budgetLine.findMany({
        where: { budgetId: activeBudget.id },
        include: {
          tags: { select: { tagId: true } },
        },
      }),
      prisma.incomeSource.findMany({
        where: { budgetId: activeBudget.id },
      }),
      prisma.untrackedCategory.findMany({
        where: { budgetId: activeBudget.id },
        include: { tags: { select: { tagId: true } } },
      }),
    ]);

    budgetLineCount = lines.length;
    incomeSourceCount = incomeSources.length;

    // Compute yearly budget total
    yearlyBudget = lines.reduce(
      (sum, l) => sum + getYearlyAmount(l.amount, l.period as BudgetPeriodType),
      0,
    );

    // Compute yearly income total
    yearlyIncome = incomeSources.reduce(
      (sum, s) => sum + getYearlyAmount(s.netAmount, s.netPeriod as BudgetPeriodType),
      0,
    );

    budgetLineTags = lines.map((l) => ({
      amount: l.amount,
      period: l.period,
      tagIds: l.tags.map((t) => t.tagId),
    }));

    untrackedCatRawTagIds = untrackedCategories.map((cat) => cat.tags.map((t) => t.tagId));
  }

  // ── Build parent→children map for tag descendant expansion ───────────────
  const childrenMap = new Map<string, string[]>();
  for (const tag of allTagsForTree) {
    if (tag.parentId) {
      const existing = childrenMap.get(tag.parentId) ?? [];
      existing.push(tag.id);
      childrenMap.set(tag.parentId, existing);
    }
  }

  // Source tag id set for quick lookups
  const sourceTagIds = new Set(allTagsForTree.filter((t) => t.isSource).map((t) => t.id));

  // Build the union of all budget line tag sets (including descendants)
  const allBudgetedTagIds = new Set<string>();
  for (const line of budgetLineTags) {
    const expanded = collectDescendantTagIds(line.tagIds, childrenMap);
    for (const id of expanded) {
      allBudgetedTagIds.add(id);
    }
  }

  // Build expanded tag sets for each untracked category (for "truly uncategorized" detection)
  const untrackedCategoryTagSets: Set<string>[] = untrackedCatRawTagIds.map((tagIds) =>
    collectDescendantTagIds(tagIds, childrenMap),
  );

  // ── Current-year transactions with their tags ────────────────────────────
  const currentYearTxs = await prisma.transaction.findMany({
    where: {
      date: { gte: yearStart, lte: yearEnd },
      archived: false,
      debit: { gt: 0 },
    },
    select: {
      id: true,
      tags: {
        select: { tagId: true },
      },
    },
  });

  let untaggedTransactionCount = 0;
  let uncategorizedTransactionCount = 0;

  for (const tx of currentYearTxs) {
    const nonSourceTagIds = tx.tags.map((t) => t.tagId).filter((id) => !sourceTagIds.has(id));

    if (nonSourceTagIds.length === 0) {
      // No non-source tags → untagged
      untaggedTransactionCount++;
    } else {
      // Has non-source tags — check if any match a budget line
      const matchesBudget = nonSourceTagIds.some((id) => allBudgetedTagIds.has(id));
      if (!matchesBudget) {
        // Untracked — also exclude transactions matched by a named untracked category
        // (mirrors the "truly uncategorized" logic in /api/untracked-categories)
        const matchesUntrackedCat = untrackedCategoryTagSets.some((tagSet) =>
          nonSourceTagIds.some((id) => tagSet.has(id)),
        );
        if (!matchesUntrackedCat) {
          uncategorizedTransactionCount++;
        }
      }
    }
  }

  return NextResponse.json({
    tagCount,
    hasBudget,
    budgetLineCount,
    incomeSourceCount,
    transactionCount,
    autoTagRuleCount,
    untaggedTransactionCount,
    uncategorizedTransactionCount,
    yearlyBudget,
    yearlyIncome,
    currentYear,
  });
}
