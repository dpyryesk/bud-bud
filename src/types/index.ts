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
  archived: boolean;
  tags: { id: string; name: string; color: string; isSource: boolean }[];
};

// ---- Budget types ----

export type Budget = {
  id: string;
  startDate: string;
  resetRollover: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BudgetWithMeta = Budget & {
  categoryCount: number;
  lineCount: number;
  validUntil: string | null;
};

export type BudgetCategory = {
  id: string;
  name: string;
  order: number;
};

export type BudgetLineWithTags = {
  id: string;
  name: string;
  period: BudgetPeriodType;
  amount: number;
  rollover: boolean;
  order: number;
  categoryId: string | null;
  category: BudgetCategory | null;
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

export type BudgetSummaryResponse = {
  activeBudget: Budget | null;
  lines: BudgetSummaryLine[];
  totalIncome: number;
  totalDebits: number;
};

// ---- Income & Untracked types ----

export type IncomeSource = {
  id: string;
  budgetId: string;
  name: string;
  netAmount: number;
  netPeriod: BudgetPeriodType;
  grossAmount: number | null;
  grossPeriod: BudgetPeriodType | null;
  order: number;
};

export type UntrackedCategoryWithSpending = {
  id: string;
  budgetId: string;
  name: string;
  order: number;
  tags: TagFlat[];
  actualSpending: number;
};

export type UntrackedCategoriesResponse = {
  categories: UntrackedCategoryWithSpending[];
  totalTrulyUncategorized: number;
  trulyUncategorizedTransactions: TransactionWithTags[];
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
  isDuplicate: boolean;
  isDuplicateInDb: boolean;
  isDuplicateInCsv: boolean;
  error?: string;
};

export type ImportPreview = {
  total: number;
  newCount: number;
  duplicates: number;
  errors: number;
  rows: ParsedTransaction[];
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
