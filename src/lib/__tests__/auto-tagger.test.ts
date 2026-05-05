import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the Prisma singleton so tests never touch a real database.
//
// vi.mock() is hoisted to the top of the file at compile time, which means
// the factory function runs BEFORE any top-level variable declarations.
// We use vi.hoisted() to create the mock fns inside that hoisted scope so
// they are defined before the factory tries to reference them.
// ---------------------------------------------------------------------------

const { mockTransactionFindMany, mockAutoTagRuleFindMany, mockTransactionTagUpsert } = vi.hoisted(
  () => ({
    mockTransactionFindMany: vi.fn(),
    mockAutoTagRuleFindMany: vi.fn(),
    mockTransactionTagUpsert: vi.fn(),
  }),
);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: { findMany: mockTransactionFindMany },
    autoTagRule: { findMany: mockAutoTagRuleFindMany },
    transactionTag: { upsert: mockTransactionTagUpsert },
  },
}));

import { runAutoTag } from '../auto-tagger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransaction(id: string, normalizedName: string) {
  return { id, normalizedName };
}

function makeRule(id: string, pattern: string, matchType: 'exact' | 'regex', tagId: string) {
  return { id, pattern, matchType, tagId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAutoTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no untagged transactions, no rules
    mockTransactionFindMany.mockResolvedValue([]);
    mockAutoTagRuleFindMany.mockResolvedValue([]);
    mockTransactionTagUpsert.mockResolvedValue({});
  });

  // -------------------------------------------------------------------------
  // Early-exit when nothing to tag
  // -------------------------------------------------------------------------

  it('returns zeros immediately when there are no untagged transactions', async () => {
    mockTransactionFindMany.mockResolvedValue([]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 0, tagged: 0, skipped: 0 });
    // Rules should not even be fetched
    expect(mockAutoTagRuleFindMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // No matching rules
  // -------------------------------------------------------------------------

  it('counts all transactions as skipped when no rules match', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makeTransaction('t1', 'starbucks'),
      makeTransaction('t2', 'tim hortons'),
    ]);
    mockAutoTagRuleFindMany.mockResolvedValue([]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 2, tagged: 0, skipped: 2 });
    expect(mockTransactionTagUpsert).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Exact match
  // -------------------------------------------------------------------------

  it('tags a transaction that exactly matches a rule (case-insensitive)', async () => {
    mockTransactionFindMany.mockResolvedValue([makeTransaction('t1', 'STARBUCKS')]);
    mockAutoTagRuleFindMany.mockResolvedValue([makeRule('r1', 'starbucks', 'exact', 'tag-coffee')]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 1, tagged: 1, skipped: 0 });
    expect(mockTransactionTagUpsert).toHaveBeenCalledOnce();
    expect(mockTransactionTagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { transactionId: 't1', tagId: 'tag-coffee' },
      }),
    );
  });

  it('does not tag a transaction that only partially matches an exact rule', async () => {
    mockTransactionFindMany.mockResolvedValue([makeTransaction('t1', 'starbucks cafe')]);
    mockAutoTagRuleFindMany.mockResolvedValue([makeRule('r1', 'starbucks', 'exact', 'tag-coffee')]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 1, tagged: 0, skipped: 1 });
    expect(mockTransactionTagUpsert).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Regex match
  // -------------------------------------------------------------------------

  it('tags a transaction that matches a regex rule', async () => {
    mockTransactionFindMany.mockResolvedValue([makeTransaction('t1', 'amazon.ca purchase')]);
    mockAutoTagRuleFindMany.mockResolvedValue([makeRule('r1', 'amazon', 'regex', 'tag-shopping')]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 1, tagged: 1, skipped: 0 });
    expect(mockTransactionTagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { transactionId: 't1', tagId: 'tag-shopping' },
      }),
    );
  });

  it('does case-insensitive regex matching', async () => {
    mockTransactionFindMany.mockResolvedValue([makeTransaction('t1', 'AMAZON PRIME')]);
    mockAutoTagRuleFindMany.mockResolvedValue([makeRule('r1', 'amazon', 'regex', 'tag-shopping')]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 1, tagged: 1, skipped: 0 });
  });

  it('skips a regex rule with an invalid pattern without throwing', async () => {
    mockTransactionFindMany.mockResolvedValue([makeTransaction('t1', 'netflix')]);
    // '[invalid' is not a valid regex
    mockAutoTagRuleFindMany.mockResolvedValue([
      makeRule('r1', '[invalid', 'regex', 'tag-streaming'),
    ]);

    const result = await runAutoTag();

    // Transaction was not tagged (invalid rule is skipped gracefully)
    expect(result).toEqual({ total: 1, tagged: 0, skipped: 1 });
    expect(mockTransactionTagUpsert).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Multiple rules can match the same transaction
  // -------------------------------------------------------------------------

  it('applies multiple matching rules to a single transaction (multiple tags)', async () => {
    mockTransactionFindMany.mockResolvedValue([makeTransaction('t1', 'uber eats delivery')]);
    mockAutoTagRuleFindMany.mockResolvedValue([
      makeRule('r1', 'uber', 'regex', 'tag-transport'),
      makeRule('r2', 'eats', 'regex', 'tag-food'),
    ]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 1, tagged: 1, skipped: 0 });
    // Two upserts — one per matching rule
    expect(mockTransactionTagUpsert).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Mixed transactions — some tagged, some skipped
  // -------------------------------------------------------------------------

  it('correctly counts tagged and skipped across multiple transactions', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makeTransaction('t1', 'starbucks'), // will match
      makeTransaction('t2', 'tim hortons'), // will match
      makeTransaction('t3', 'mystery vendor'), // no match
    ]);
    mockAutoTagRuleFindMany.mockResolvedValue([
      makeRule('r1', 'starbucks', 'exact', 'tag-coffee'),
      makeRule('r2', 'tim hortons', 'exact', 'tag-coffee'),
    ]);

    const result = await runAutoTag();

    expect(result).toEqual({ total: 3, tagged: 2, skipped: 1 });
  });

  // -------------------------------------------------------------------------
  // Date filtering is forwarded to prisma.transaction.findMany
  // -------------------------------------------------------------------------

  it('passes date range to findMany when start and end are provided', async () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-31');
    mockTransactionFindMany.mockResolvedValue([]);

    await runAutoTag(start, end);

    expect(mockTransactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { gte: start, lte: end },
        }),
      }),
    );
  });

  it('does NOT add a date filter when start/end are omitted', async () => {
    mockTransactionFindMany.mockResolvedValue([]);

    await runAutoTag();

    const callArg = mockTransactionFindMany.mock.calls[0][0];
    expect(callArg.where.date).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Upsert shape
  // -------------------------------------------------------------------------

  it('calls transactionTag.upsert with the correct where/create shape', async () => {
    mockTransactionFindMany.mockResolvedValue([makeTransaction('txn-abc', 'netflix')]);
    mockAutoTagRuleFindMany.mockResolvedValue([
      makeRule('rule-1', 'netflix', 'exact', 'tag-streaming'),
    ]);

    await runAutoTag();

    expect(mockTransactionTagUpsert).toHaveBeenCalledWith({
      where: {
        transactionId_tagId: {
          transactionId: 'txn-abc',
          tagId: 'tag-streaming',
        },
      },
      create: { transactionId: 'txn-abc', tagId: 'tag-streaming' },
      update: {},
    });
  });
});
