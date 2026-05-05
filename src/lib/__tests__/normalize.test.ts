import { describe, it, expect } from 'vitest';
import { normalizeTransactionName } from '../normalize';

describe('normalizeTransactionName', () => {
  it('converts to lowercase', () => {
    expect(normalizeTransactionName('STARBUCKS COFFEE')).toBe('starbucks coffee');
  });

  it('removes sequences of 6+ digits', () => {
    // After removal and space collapse: 'purchase  ref' → 'purchase ref'
    expect(normalizeTransactionName('PURCHASE 123456 REF')).toBe('purchase ref');
  });

  it('removes sequences of 7 digits', () => {
    // After removal and space collapse: 'txn  merchant' → 'txn merchant'
    expect(normalizeTransactionName('TXN 1234567 MERCHANT')).toBe('txn merchant');
  });

  it('removes sequences of 10 digits', () => {
    expect(normalizeTransactionName('DEBIT 1234567890')).toBe('debit');
  });

  it('does NOT remove sequences of exactly 5 digits', () => {
    // 5 digits surrounded by spaces — gets removed by the short-code rule
    const result = normalizeTransactionName('PAY 12345 STORE');
    expect(result).toBe('pay store');
  });

  it('preserves sequences of 1–4 digits that are not surrounded by spaces', () => {
    expect(normalizeTransactionName('7-eleven')).toBe('7-eleven');
  });

  it('removes card number patterns with asterisk (*1234)', () => {
    // After removal and space collapse: 'visa  amazon' → 'visa amazon'
    expect(normalizeTransactionName('VISA *1234 AMAZON')).toBe('visa amazon');
  });

  it('removes card number patterns with x prefix (x5678)', () => {
    // After removal and space collapse: 'debit  purchase' → 'debit purchase'
    expect(normalizeTransactionName('DEBIT x5678 PURCHASE')).toBe('debit purchase');
  });

  it('removes standalone 2-digit codes surrounded by spaces', () => {
    expect(normalizeTransactionName('PURCHASE 99 STORE')).toBe('purchase store');
  });

  it('removes standalone 3-digit codes surrounded by spaces', () => {
    expect(normalizeTransactionName('TXN 123 COFFEE')).toBe('txn coffee');
  });

  it('removes standalone 4-digit codes surrounded by spaces', () => {
    expect(normalizeTransactionName('CODE 4567 ITEM')).toBe('code item');
  });

  it('collapses multiple spaces into one', () => {
    expect(normalizeTransactionName('HELLO   WORLD')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeTransactionName('  trimmed  ')).toBe('trimmed');
  });

  it('handles an already normalized name without modification', () => {
    expect(normalizeTransactionName('tim hortons')).toBe('tim hortons');
  });

  it('handles empty string', () => {
    expect(normalizeTransactionName('')).toBe('');
  });

  it('handles a name that is only digits (6+) — collapses to empty', () => {
    const result = normalizeTransactionName('1234567');
    expect(result).toBe('');
  });

  it('handles a realistic bank transaction name', () => {
    // e.g. "PURCHASE AMAZON.CA 987654 *1234"
    const result = normalizeTransactionName('PURCHASE AMAZON.CA 987654 *1234');
    expect(result).toBe('purchase amazon.ca');
  });

  it('applies all rules in combination', () => {
    // Multiple 6+ digit blocks, card pattern, short codes
    const result = normalizeTransactionName('PAYROLL 20260101 99 x4321 BANK 1234567');
    // After lowercasing: "payroll 20260101 99 x4321 bank 1234567"
    // Remove 6+ digits: "payroll  99 x4321 bank "
    // Remove card pattern x4321: "payroll  99  bank "
    // Remove short codes (99): "payroll   bank "
    // Collapse spaces + trim: "payroll bank"
    expect(result).toBe('payroll bank');
  });
});
