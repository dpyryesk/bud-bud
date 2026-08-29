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

function utcYear(value) {
  return new Date(String(value)).getUTCFullYear();
}

function isJanuaryFirst(value) {
  const date = new Date(String(value));
  return date.getUTCMonth() === 0 && date.getUTCDate() === 1;
}

async function verifyUntrackedCategories() {
  const sourceColumns = await source.execute('PRAGMA table_info("UntrackedCategory")');
  const isLegacySchema = sourceColumns.rows.some((column) => column.name === 'budgetId');

  const [sourceCategories, sourceTags, migratedCategories, migratedTags] = await Promise.all([
    source.execute(
      isLegacySchema
        ? 'SELECT id, budgetId, name, "order" FROM "UntrackedCategory"'
        : 'SELECT id, year, name, "order" FROM "UntrackedCategory"',
    ),
    source.execute('SELECT untrackedCategoryId, tagId FROM "UntrackedCategoryTag" ORDER BY tagId'),
    migrated.execute('SELECT id, year, name, "order" FROM "UntrackedCategory"'),
    migrated.execute(
      'SELECT untrackedCategoryId, tagId FROM "UntrackedCategoryTag" ORDER BY tagId',
    ),
  ]);

  const sourceTagIds = new Map();
  for (const tag of sourceTags.rows) {
    const categoryId = String(tag.untrackedCategoryId);
    const tagIds = sourceTagIds.get(categoryId) ?? [];
    tagIds.push(String(tag.tagId));
    sourceTagIds.set(categoryId, tagIds);
  }
  for (const tagIds of sourceTagIds.values()) tagIds.sort();

  let expectedCandidates;
  if (isLegacySchema) {
    const migrationTable = await migrated.execute(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'`,
    );
    const migrationRecord = migrationTable.rows.length
      ? await migrated.execute(`
          SELECT finished_at
          FROM "_prisma_migrations"
          WHERE migration_name = '20260829190000_move_untracked_categories_to_year'
            AND finished_at IS NOT NULL
          LIMIT 1
        `)
      : { rows: [] };
    const migrationYear = migrationRecord.rows[0]?.finished_at
      ? utcYear(migrationRecord.rows[0].finished_at)
      : new Date().getUTCFullYear();
    const [budgetResult, maximumTransactionYearResult] = await Promise.all([
      source.execute('SELECT id, startDate FROM "Budget" ORDER BY startDate'),
      source.execute(
        'SELECT MAX(CAST(strftime(\'%Y\', "date") AS INTEGER)) AS year FROM "Transaction"',
      ),
    ]);
    const budgets = budgetResult.rows.map((budget) => ({
      id: String(budget.id),
      startDate: budget.startDate,
    }));
    const maximumYear = Math.max(
      migrationYear,
      Number(maximumTransactionYearResult.rows[0]?.year ?? 1900),
      ...budgets.map((budget) => utcYear(budget.startDate)),
    );
    const yearsByBudget = new Map();
    for (let index = 0; index < budgets.length; index += 1) {
      const budget = budgets[index];
      const nextBudget = budgets[index + 1];
      const startYear = utcYear(budget.startDate);
      const computedEndYear = nextBudget
        ? utcYear(nextBudget.startDate) - (isJanuaryFirst(nextBudget.startDate) ? 1 : 0)
        : maximumYear;
      const endYear = Math.max(startYear, computedEndYear);
      yearsByBudget.set(
        budget.id,
        Array.from({ length: endYear - startYear + 1 }, (_, offset) => startYear + offset),
      );
    }
    expectedCandidates = sourceCategories.rows.flatMap((category) => {
      const categoryId = String(category.id);
      const years = yearsByBudget.get(String(category.budgetId)) ?? [];
      const startYear = years[0];
      const tagIds = sourceTagIds.get(categoryId) ?? [];
      return years.map((year) => ({
        candidateId: year === startYear ? categoryId : `${categoryId}__year_${year}`,
        year,
        name: String(category.name),
        order: Number(category.order),
        tagIds,
      }));
    });
  } else {
    expectedCandidates = sourceCategories.rows.map((category) => ({
      candidateId: String(category.id),
      year: Number(category.year),
      name: String(category.name),
      order: Number(category.order),
      tagIds: sourceTagIds.get(String(category.id)) ?? [],
    }));
  }

  const equivalentGroups = new Map();
  for (const candidate of expectedCandidates) {
    const key = `${candidate.year}\u0000${candidate.name}\u0000${candidate.tagIds.join(',')}`;
    const group = equivalentGroups.get(key) ?? [];
    group.push(candidate);
    equivalentGroups.set(key, group);
  }
  const expectedCategories = [...equivalentGroups.values()].map((group) => ({
    id: group.map((candidate) => candidate.candidateId).sort()[0],
    year: group[0].year,
    name: group[0].name,
    order: Math.min(...group.map((candidate) => candidate.order)),
    tagIds: group[0].tagIds,
  }));

  if (migratedCategories.rows.length !== expectedCategories.length) {
    throw new Error(
      `UntrackedCategory mapping count mismatch: expected ${expectedCategories.length}, found ${migratedCategories.rows.length}`,
    );
  }
  const actualCategories = new Map(
    migratedCategories.rows.map((category) => [String(category.id), category]),
  );
  for (const expected of expectedCategories) {
    const actual = actualCategories.get(expected.id);
    if (
      !actual ||
      Number(actual.year) !== expected.year ||
      String(actual.name) !== expected.name ||
      Number(actual.order) !== expected.order
    ) {
      throw new Error(`UntrackedCategory mapping changed unexpectedly for ${expected.id}`);
    }
  }

  const expectedTagMappings = new Set(
    expectedCategories.flatMap((category) =>
      category.tagIds.map((tagId) => `${category.id}\u0000${tagId}`),
    ),
  );
  const actualTagMappings = new Set(
    migratedTags.rows.map((tag) => `${String(tag.untrackedCategoryId)}\u0000${String(tag.tagId)}`),
  );
  if (
    actualTagMappings.size !== expectedTagMappings.size ||
    [...expectedTagMappings].some((mapping) => !actualTagMappings.has(mapping))
  ) {
    throw new Error('UntrackedCategoryTag mappings changed unexpectedly');
  }
}

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

  await verifyUntrackedCategories();

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
