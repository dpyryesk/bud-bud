import { createClient } from '@libsql/client';

export const applicationTables = [
  'Transaction',
  'Tag',
  'TransactionTag',
  'Budget',
  'BudgetCategory',
  'BudgetLine',
  'BudgetLineTag',
  'CsvMapping',
  'AutoTagRule',
  'IncomeSource',
  'UntrackedCategory',
  'UntrackedCategoryTag',
];

export function toFileUrl(filePath) {
  return `file:${filePath.replaceAll('\\', '/')}`;
}

export async function hasApplicationSchema(filePath) {
  const client = createClient({ url: toFileUrl(filePath) });
  try {
    const result = await client.execute(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'Transaction' LIMIT 1",
    );
    return result.rows.length > 0;
  } finally {
    client.close();
  }
}
