import { describe, it, expect } from 'vitest';
import { hashTransaction } from '../hash';

const baseFields = {
  date: '2026-01-15',
  name: 'STARBUCKS',
  debit: 5.75,
  credit: 0,
  source: 'TD Chequing',
};

describe('hashTransaction', () => {
  it('returns a string', async () => {
    const result = await hashTransaction(baseFields);
    expect(typeof result).toBe('string');
  });

  it('returns a 64-character hexadecimal string (SHA-256)', async () => {
    const result = await hashTransaction(baseFields);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces the same hash', async () => {
    const hash1 = await hashTransaction(baseFields);
    const hash2 = await hashTransaction(baseFields);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different dates', async () => {
    const hash1 = await hashTransaction({ ...baseFields, date: '2026-01-01' });
    const hash2 = await hashTransaction({ ...baseFields, date: '2026-01-02' });
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different names', async () => {
    const hash1 = await hashTransaction({ ...baseFields, name: 'TIM HORTONS' });
    const hash2 = await hashTransaction({ ...baseFields, name: 'STARBUCKS' });
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different debit amounts', async () => {
    const hash1 = await hashTransaction({ ...baseFields, debit: 10 });
    const hash2 = await hashTransaction({ ...baseFields, debit: 20 });
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different credit amounts', async () => {
    const hash1 = await hashTransaction({ ...baseFields, credit: 0 });
    const hash2 = await hashTransaction({ ...baseFields, credit: 100 });
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different sources', async () => {
    const hash1 = await hashTransaction({ ...baseFields, source: 'TD Chequing' });
    const hash2 = await hashTransaction({ ...baseFields, source: 'TD Savings' });
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes when debit and credit are swapped', async () => {
    // Ensures both fields are independently part of the hash
    const hash1 = await hashTransaction({ ...baseFields, debit: 50, credit: 0 });
    const hash2 = await hashTransaction({ ...baseFields, debit: 0, credit: 50 });
    expect(hash1).not.toBe(hash2);
  });

  it('handles zero amounts', async () => {
    const result = await hashTransaction({
      date: '2026-01-01',
      name: 'TEST',
      debit: 0,
      credit: 0,
      source: 'bank',
    });
    expect(result).toHaveLength(64);
  });

  it('handles empty string fields', async () => {
    const result = await hashTransaction({
      date: '',
      name: '',
      debit: 0,
      credit: 0,
      source: '',
    });
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});
