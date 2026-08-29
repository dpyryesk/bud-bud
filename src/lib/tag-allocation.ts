export type TagClassification = { id: string; isSource: boolean };

export function getNonSourceTagIds(tags: TagClassification[]): string[] {
  return tags.filter((tag) => !tag.isSource).map((tag) => tag.id);
}

/**
 * A transaction is tracked only when it has at least one category tag and every
 * category tag is covered. This prevents a multi-tag transaction from appearing
 * in both budgeted and untracked totals.
 */
export function isFullyTracked(nonSourceTagIds: string[], coveredTagIds: Set<string>): boolean {
  return nonSourceTagIds.length > 0 && nonSourceTagIds.every((tagId) => coveredTagIds.has(tagId));
}

export function matchingTagSetIndexes(
  nonSourceTagIds: string[],
  tagSets: ReadonlyArray<Set<string>>,
): number[] {
  return tagSets
    .map((tagSet, index) => (nonSourceTagIds.some((tagId) => tagSet.has(tagId)) ? index : -1))
    .filter((index) => index >= 0);
}

export function allocationShareForTagSet(
  nonSourceTagIds: string[],
  targetTagSet: Set<string>,
  allTagSets: ReadonlyArray<Set<string>>,
): number {
  const matches = matchingTagSetIndexes(nonSourceTagIds, allTagSets);
  if (matches.length === 0 || !nonSourceTagIds.some((tagId) => targetTagSet.has(tagId))) {
    return 0;
  }
  return 1 / matches.length;
}
