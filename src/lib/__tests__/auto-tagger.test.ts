import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findTransactions, findRules, createAssignments } = vi.hoisted(() => ({
  findTransactions: vi.fn(),
  findRules: vi.fn(),
  createAssignments: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: { findMany: findTransactions },
    autoTagRule: { findMany: findRules },
    transactionTag: { createMany: createAssignments },
  },
}));

import { runAutoTag } from '../auto-tagger';

describe('runAutoTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findTransactions.mockResolvedValue([]);
    findRules.mockResolvedValue([]);
    createAssignments.mockResolvedValue({ count: 0 });
  });

  it('returns early when there is nothing to tag', async () => {
    await expect(runAutoTag()).resolves.toEqual({ total: 0, tagged: 0, skipped: 0 });
    expect(findRules).not.toHaveBeenCalled();
  });

  it('bulk applies case-insensitive exact matches', async () => {
    findTransactions.mockResolvedValue([{ id: 't1', normalizedName: 'STARBUCKS' }]);
    findRules.mockResolvedValue([{ pattern: 'starbucks', matchType: 'exact', tagId: 'coffee' }]);
    await expect(runAutoTag()).resolves.toEqual({ total: 1, tagged: 1, skipped: 0 });
    expect(createAssignments).toHaveBeenCalledWith({
      data: [{ transactionId: 't1', tagId: 'coffee' }],
    });
  });

  it('uses safe, case-insensitive regex matching', async () => {
    findTransactions.mockResolvedValue([{ id: 't1', normalizedName: 'AMAZON PRIME' }]);
    findRules.mockResolvedValue([{ pattern: 'amazon', matchType: 'regex', tagId: 'shopping' }]);
    await expect(runAutoTag()).resolves.toEqual({ total: 1, tagged: 1, skipped: 0 });
  });

  it('skips invalid legacy regex rules', async () => {
    findTransactions.mockResolvedValue([{ id: 't1', normalizedName: 'anything' }]);
    findRules.mockResolvedValue([{ pattern: '[invalid', matchType: 'regex', tagId: 'tag' }]);
    await expect(runAutoTag()).resolves.toEqual({ total: 1, tagged: 0, skipped: 1 });
    expect(createAssignments).not.toHaveBeenCalled();
  });

  it('deduplicates assignments while allowing multiple tags', async () => {
    findTransactions.mockResolvedValue([{ id: 't1', normalizedName: 'uber eats' }]);
    findRules.mockResolvedValue([
      { pattern: 'uber', matchType: 'regex', tagId: 'transport' },
      { pattern: 'eats', matchType: 'regex', tagId: 'food' },
      { pattern: 'uber', matchType: 'regex', tagId: 'transport' },
    ]);
    await runAutoTag();
    expect(createAssignments).toHaveBeenCalledWith({
      data: [
        { transactionId: 't1', tagId: 'transport' },
        { transactionId: 't1', tagId: 'food' },
      ],
    });
  });

  it('counts unmatched transactions as skipped', async () => {
    findTransactions.mockResolvedValue([
      { id: 't1', normalizedName: 'match' },
      { id: 't2', normalizedName: 'other' },
    ]);
    findRules.mockResolvedValue([{ pattern: 'match', matchType: 'exact', tagId: 'tag' }]);
    await expect(runAutoTag()).resolves.toEqual({ total: 2, tagged: 1, skipped: 1 });
  });

  it('forwards a date range to the database', async () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-31T23:59:59Z');
    await runAutoTag(start, end);
    expect(findTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: { gte: start, lte: end } }),
      }),
    );
  });

  it('rejects more than 10,000 matching transactions', async () => {
    findTransactions.mockResolvedValue(
      Array.from({ length: 10_001 }, (_, index) => ({ id: String(index), normalizedName: 'x' })),
    );
    await expect(runAutoTag()).rejects.toThrow('10,000');
  });
});
