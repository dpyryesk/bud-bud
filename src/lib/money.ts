export const MAX_MONEY_CENTS = 100_000_000_000;

/** Convert a public dollar amount to the integer-cent representation stored in SQLite. */
export function toCents(value: number | string): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Money amount must be finite');
  }
  const cents = Math.round((numeric + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_MONEY_CENTS) {
    throw new Error('Money amount is outside the supported range');
  }
  return cents;
}

/** Convert SQLite integer cents to the dollar values exposed by the API. */
export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error('Stored money amount is not a safe integer');
  }
  return cents / 100;
}

/** Convert a computed cent value that may contain allocation fractions to public dollars. */
export function fromComputedCents(cents: number): number {
  if (!Number.isFinite(cents)) throw new Error('Computed money amount must be finite');
  return Math.round(cents) / 100;
}

export function moneyFieldsFromCents<T extends { debit: number; credit: number }>(
  value: T,
): Omit<T, 'debit' | 'credit'> & { debit: number; credit: number } {
  return { ...value, debit: fromCents(value.debit), credit: fromCents(value.credit) };
}
