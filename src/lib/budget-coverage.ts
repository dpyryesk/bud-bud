import type { Budget } from '@/generated/prisma/client';
import { collectDescendantTagIds } from '@/lib/tag-tree';

export type BudgetLineTags = {
  budgetId: string;
  tags: Array<{ tag: { id: string } }>;
};

export function findApplicableBudget<T extends Pick<Budget, 'id' | 'startDate'>>(
  budgets: T[],
  date: Date,
): T | null {
  let applicable: T | null = null;
  for (const budget of budgets) {
    if (budget.startDate <= date) applicable = budget;
    else break;
  }
  return applicable;
}

export function buildChildrenMap(tags: Array<{ id: string; parentId: string | null }>) {
  const childrenMap = new Map<string, string[]>();
  for (const tag of tags) {
    if (!tag.parentId) continue;
    const children = childrenMap.get(tag.parentId) ?? [];
    children.push(tag.id);
    childrenMap.set(tag.parentId, children);
  }
  return childrenMap;
}

export function buildCoveredTagsByBudget(
  lines: BudgetLineTags[],
  childrenMap: Map<string, string[]>,
) {
  const result = new Map<string, Set<string>>();
  for (const line of lines) {
    const covered = result.get(line.budgetId) ?? new Set<string>();
    for (const id of collectDescendantTagIds(
      line.tags.map((entry) => entry.tag.id),
      childrenMap,
    )) {
      covered.add(id);
    }
    result.set(line.budgetId, covered);
  }
  return result;
}
