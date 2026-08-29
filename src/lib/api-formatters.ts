import { fromCents } from '@/lib/money';

export function transactionMoneyFromCents<T extends { debit: number; credit: number }>(value: T) {
  return { ...value, debit: fromCents(value.debit), credit: fromCents(value.credit) };
}

export function budgetLineMoneyFromCents<T extends { amount: number }>(value: T) {
  return { ...value, amount: fromCents(value.amount) };
}

export function incomeSourceMoneyFromCents<
  T extends { netAmount: number; grossAmount: number | null },
>(value: T) {
  return {
    ...value,
    netAmount: fromCents(value.netAmount),
    grossAmount: value.grossAmount === null ? null : fromCents(value.grossAmount),
  };
}

export function transactionWithTagsFromCents<
  T extends {
    debit: number;
    credit: number;
    tags: Array<{ tag: unknown }>;
  },
>(value: T) {
  return {
    ...transactionMoneyFromCents(value),
    tags: value.tags.map((entry) => entry.tag),
  };
}
