import { describe, expect, it } from 'vitest';
import { fromCents, fromComputedCents, toCents } from '../money';
import { compileSafeRegex, matchesAutoTagPattern } from '../safe-regex';
import { allocationShareForTagSet, isFullyTracked } from '../tag-allocation';

describe('money storage', () => {
  it('round-trips public dollars through integer cents', () => {
    expect(toCents('10.29')).toBe(1029);
    expect(fromCents(1029)).toBe(10.29);
  });

  it('rounds allocated fractional cents only at the API boundary', () => {
    expect(fromComputedCents(1000 / 3)).toBe(3.33);
  });

  it('rejects non-finite and unsafe values', () => {
    expect(() => toCents(Number.NaN)).toThrow();
    expect(() => toCents(Number.MAX_SAFE_INTEGER)).toThrow();
  });
});

describe('consistent budget tracking', () => {
  const covered = new Set(['groceries', 'utilities']);

  it('requires every category tag to be covered', () => {
    expect(isFullyTracked(['groceries'], covered)).toBe(true);
    expect(isFullyTracked(['groceries', 'unplanned'], covered)).toBe(false);
    expect(isFullyTracked([], covered)).toBe(false);
  });

  it('splits a transaction evenly across matching budget lines', () => {
    const sets = [new Set(['food']), new Set(['dining'])];
    expect(allocationShareForTagSet(['food', 'dining'], sets[0], sets)).toBe(0.5);
    expect(allocationShareForTagSet(['food', 'dining'], sets[1], sets)).toBe(0.5);
  });
});

describe('safe auto-tag patterns', () => {
  it('supports exact and Unicode-aware regex matches', () => {
    expect(matchesAutoTagPattern('CAFÉ', 'café', 'exact')).toBe(true);
    expect(compileSafeRegex('amazon|market').test('AMAZON PRIME')).toBe(true);
  });

  it('rejects unsupported or overlong patterns', () => {
    expect(() => compileSafeRegex('(?=lookahead)')).toThrow();
    expect(() => compileSafeRegex('x'.repeat(201))).toThrow();
  });
});
