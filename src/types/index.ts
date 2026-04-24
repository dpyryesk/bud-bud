import type { BudgetPeriodType, TimePeriod } from '@/lib/date-utils';

// ---- Tag types ----

export type TagTree = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  children: TagTree[];
};

export type TagFlat = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
};

// ---- Transaction types ----

export type TransactionWithTags = {
  id: string;
  date: string;
  name: string;
  normalizedName: string;
  debit: number;
  credit: number;
  source: string;
  notes: string;
  tags: { id: string; name: string; color: string; isSource: boolean }[];
};

// ---- Budget types ----

export type BudgetLineWithTags = {
  id: string;
  name: string;
  period: BudgetPeriodType;
  amount: number;
  rollover: boolean;
  tags: TagFlat[];
};

export type BudgetSummaryLine = {
  budgetLine: BudgetLineWithTags;
  scaledBudget: number;
  actualSpending: number;
  remaining: number;
  rolloverAmount: number;
  effectiveBudget: number;
};

// ---- CSV Import types ----

export type CsvMappingConfig = {
  id?: string;
  name: string;
  dateColumn: string;
  nameColumn: string;
  debitColumn: string;
  creditColumn: string;
  sourceColumn: string;
  dateFormat: string;
  sourceTagId: string | null;
};

export type ParsedTransaction = {
  date: string;
  name: string;
  debit: number;
  credit: number;
  source: string;
  csvHash: string;
  normalizedName: string;
  isDuplicate?: boolean;
};

export type ImportResult = {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
};

// ---- Auto-tag types ----

export type AutoTagRuleData = {
  id: string;
  pattern: string;
  matchType: 'exact' | 'regex';
  tagId: string;
  tag: TagFlat;
};

// Re-export
export type { TimePeriod, BudgetPeriodType };
