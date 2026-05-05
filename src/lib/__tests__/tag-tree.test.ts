import { describe, it, expect } from 'vitest';
import {
  buildTagTree,
  flattenTagTreeWithLevel,
  buildTagsInDisplayOrder,
  collectDescendantTagIds,
  type TagLike,
} from '../tag-tree';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTag(id: string, parentId: string | null, order: number, name?: string): TagLike {
  return { id, name: name ?? id, parentId, order };
}

// ---------------------------------------------------------------------------
// buildTagTree
// ---------------------------------------------------------------------------

describe('buildTagTree', () => {
  it('returns an empty array for empty input', () => {
    expect(buildTagTree([])).toEqual([]);
  });

  it('returns root nodes for tags without a parentId', () => {
    const tags = [makeTag('a', null, 1), makeTag('b', null, 2)];
    const tree = buildTagTree(tags);
    expect(tree).toHaveLength(2);
  });

  it('nests child tags under their parent', () => {
    const tags = [makeTag('parent', null, 1), makeTag('child', 'parent', 1)];
    const tree = buildTagTree(tags);
    expect(tree).toHaveLength(1);
    expect(tree[0].childrenFull).toHaveLength(1);
    expect(tree[0].childrenFull[0].id).toBe('child');
  });

  it('sorts root nodes by order', () => {
    const tags = [makeTag('b', null, 2), makeTag('a', null, 1)];
    const tree = buildTagTree(tags);
    expect(tree[0].id).toBe('a');
    expect(tree[1].id).toBe('b');
  });

  it('sorts children by order within a parent', () => {
    const tags = [
      makeTag('parent', null, 1),
      makeTag('child2', 'parent', 2),
      makeTag('child1', 'parent', 1),
    ];
    const tree = buildTagTree(tags);
    expect(tree[0].childrenFull[0].id).toBe('child1');
    expect(tree[0].childrenFull[1].id).toBe('child2');
  });

  it('uses name as tiebreaker when orders are equal', () => {
    const tags = [makeTag('b', null, 1, 'Banana'), makeTag('a', null, 1, 'Apple')];
    const tree = buildTagTree(tags);
    expect(tree[0].name).toBe('Apple');
    expect(tree[1].name).toBe('Banana');
  });

  it('treats tags with an unresolvable parentId as root nodes', () => {
    const tags = [makeTag('orphan', 'nonexistent-parent', 1)];
    const tree = buildTagTree(tags);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });

  it('handles deeply nested structures (grandchildren)', () => {
    const tags = [
      makeTag('root', null, 1),
      makeTag('child', 'root', 1),
      makeTag('grandchild', 'child', 1),
    ];
    const tree = buildTagTree(tags);
    expect(tree[0].childrenFull[0].childrenFull[0].id).toBe('grandchild');
  });

  it('attaches a data property equal to the original tag', () => {
    const tag = makeTag('x', null, 1);
    const tree = buildTagTree([tag]);
    expect(tree[0].data).toEqual(tag);
  });
});

// ---------------------------------------------------------------------------
// flattenTagTreeWithLevel
// ---------------------------------------------------------------------------

describe('flattenTagTreeWithLevel', () => {
  it('returns an empty array for an empty tree', () => {
    expect(flattenTagTreeWithLevel([])).toEqual([]);
  });

  it('assigns level 0 to root nodes', () => {
    const tags = [makeTag('root', null, 1)];
    const tree = buildTagTree(tags);
    const flat = flattenTagTreeWithLevel(tree);
    expect(flat[0].level).toBe(0);
  });

  it('assigns level 1 to first-level children', () => {
    const tags = [makeTag('root', null, 1), makeTag('child', 'root', 1)];
    const tree = buildTagTree(tags);
    const flat = flattenTagTreeWithLevel(tree);
    expect(flat.find((t) => t.id === 'child')!.level).toBe(1);
  });

  it('assigns level 2 to grandchildren', () => {
    const tags = [
      makeTag('root', null, 1),
      makeTag('child', 'root', 1),
      makeTag('grandchild', 'child', 1),
    ];
    const tree = buildTagTree(tags);
    const flat = flattenTagTreeWithLevel(tree);
    expect(flat.find((t) => t.id === 'grandchild')!.level).toBe(2);
  });

  it('uses depth-first order (parent immediately followed by children)', () => {
    const tags = [
      makeTag('root', null, 1),
      makeTag('child1', 'root', 1),
      makeTag('child2', 'root', 2),
    ];
    const tree = buildTagTree(tags);
    const flat = flattenTagTreeWithLevel(tree);
    expect(flat.map((t) => t.id)).toEqual(['root', 'child1', 'child2']);
  });

  it('accepts a custom starting level', () => {
    const tags = [makeTag('root', null, 1)];
    const tree = buildTagTree(tags);
    const flat = flattenTagTreeWithLevel(tree, 5);
    expect(flat[0].level).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// buildTagsInDisplayOrder
// ---------------------------------------------------------------------------

describe('buildTagsInDisplayOrder', () => {
  it('returns an empty array for empty input', () => {
    expect(buildTagsInDisplayOrder([])).toEqual([]);
  });

  it('returns tags sorted in depth-first display order with level annotations', () => {
    const tags = [
      makeTag('root', null, 1),
      makeTag('child', 'root', 1),
      makeTag('sibling', null, 2),
    ];
    const result = buildTagsInDisplayOrder(tags);
    expect(result.map((t) => t.id)).toEqual(['root', 'child', 'sibling']);
    expect(result[0].level).toBe(0);
    expect(result[1].level).toBe(1);
    expect(result[2].level).toBe(0);
  });

  it('does not rely on raw API input order', () => {
    // Input in reverse order — output must still be correct tree order
    const tags = [
      makeTag('sibling', null, 2),
      makeTag('child', 'root', 1),
      makeTag('root', null, 1),
    ];
    const result = buildTagsInDisplayOrder(tags);
    expect(result.map((t) => t.id)).toEqual(['root', 'child', 'sibling']);
  });
});

// ---------------------------------------------------------------------------
// collectDescendantTagIds
// ---------------------------------------------------------------------------

describe('collectDescendantTagIds', () => {
  it('returns the seed IDs when there are no children', () => {
    const childrenMap = new Map<string, string[]>();
    const result = collectDescendantTagIds(['a', 'b'], childrenMap);
    expect(result).toEqual(new Set(['a', 'b']));
  });

  it('includes direct children of the seed IDs', () => {
    const childrenMap = new Map([['a', ['a1', 'a2']]]);
    const result = collectDescendantTagIds(['a'], childrenMap);
    expect(result).toEqual(new Set(['a', 'a1', 'a2']));
  });

  it('includes grandchildren (recursive)', () => {
    const childrenMap = new Map([
      ['a', ['b']],
      ['b', ['c']],
    ]);
    const result = collectDescendantTagIds(['a'], childrenMap);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
  });

  it('does not include IDs from unrelated branches', () => {
    const childrenMap = new Map([
      ['a', ['a1']],
      ['b', ['b1']],
    ]);
    const result = collectDescendantTagIds(['a'], childrenMap);
    expect(result.has('b')).toBe(false);
    expect(result.has('b1')).toBe(false);
  });

  it('handles multiple seed IDs', () => {
    const childrenMap = new Map([
      ['a', ['a1']],
      ['b', ['b1']],
    ]);
    const result = collectDescendantTagIds(['a', 'b'], childrenMap);
    expect(result).toEqual(new Set(['a', 'b', 'a1', 'b1']));
  });

  it('does not visit nodes twice when a tag appears in multiple branches', () => {
    // 'shared' is reachable via both 'a' and 'b'; it should only appear once.
    const childrenMap = new Map([
      ['a', ['shared']],
      ['b', ['shared']],
      ['shared', ['leaf']],
    ]);
    const result = collectDescendantTagIds(['a', 'b'], childrenMap);
    expect([...result].filter((id) => id === 'leaf').length).toBe(1);
    expect(result).toEqual(new Set(['a', 'b', 'shared', 'leaf']));
  });

  it('returns an empty set for empty seed IDs', () => {
    const childrenMap = new Map([['a', ['a1']]]);
    const result = collectDescendantTagIds([], childrenMap);
    expect(result.size).toBe(0);
  });
});
