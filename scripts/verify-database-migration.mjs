import path from 'node:path';
import process from 'node:process';
import { createClient } from '@libsql/client';

const [sourceArg, migratedArg] = process.argv.slice(2);
if (!sourceArg || !migratedArg) {
  console.error('Usage: node scripts/verify-database-migration.mjs <source.db> <migrated.db>');
  process.exit(2);
}

const sourcePath = path.resolve(sourceArg);
const migratedPath = path.resolve(migratedArg);
const source = createClient({ url: `file:${sourcePath}` });
const migrated = createClient({ url: `file:${migratedPath}` });

try {
  const integrity = await migrated.execute('PRAGMA integrity_check');
  if (integrity.rows[0]?.integrity_check !== 'ok')
    throw new Error('Migrated database integrity check failed');
  const foreignKeys = await migrated.execute('PRAGMA foreign_key_check');
  if (foreignKeys.rows.length)
    throw new Error(`Migrated database has ${foreignKeys.rows.length} foreign-key violations`);

  const tables = [
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
  for (const table of tables) {
    const [before, after] = await Promise.all([
      source.execute(`SELECT COUNT(*) AS count FROM "${table}"`),
      migrated.execute(`SELECT COUNT(*) AS count FROM "${table}"`),
    ]);
    if (Number(before.rows[0].count) !== Number(after.rows[0].count)) {
      throw new Error(`${table} row count changed during migration`);
    }
  }

  const moneyChecks = [
    ['Transaction', ['debit', 'credit']],
    ['BudgetLine', ['amount']],
    ['IncomeSource', ['netAmount', 'grossAmount']],
  ];
  for (const [table, columns] of moneyChecks) {
    const selected = ['id', ...columns];
    const [before, after] = await Promise.all([
      source.execute(
        `SELECT ${selected.map((name) => `"${name}"`).join(', ')} FROM "${table}" ORDER BY id`,
      ),
      migrated.execute(
        `SELECT ${selected.map((name) => `"${name}"`).join(', ')} FROM "${table}" ORDER BY id`,
      ),
    ]);
    for (let index = 0; index < before.rows.length; index += 1) {
      if (before.rows[index].id !== after.rows[index].id) throw new Error(`${table} ids changed`);
      for (const column of columns) {
        const oldValue = before.rows[index][column];
        const expected = oldValue === null ? null : Math.round(Number(oldValue) * 100);
        if (after.rows[index][column] !== expected) {
          throw new Error(`${table}.${column} changed unexpectedly for ${before.rows[index].id}`);
        }
      }
    }
  }

  const crossBudget = await migrated.execute(`
    SELECT COUNT(*) AS count
    FROM "BudgetLine" AS line
    JOIN "BudgetCategory" AS category ON category.id = line.categoryId
    WHERE line.budgetId <> category.budgetId
  `);
  if (Number(crossBudget.rows[0].count) !== 0) throw new Error('Cross-budget categories remain');

  console.log(`Verified migration without data loss: ${sourcePath} -> ${migratedPath}`);
} finally {
  source.close();
  migrated.close();
}
