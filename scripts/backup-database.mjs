import 'dotenv/config';

import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { applicationTables, toFileUrl } from './database-schema.mjs';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/bud.db';

if (!databaseUrl.startsWith('file:')) {
  throw new Error('Database backup currently supports file-backed SQLite databases only.');
}

const sourcePath = path.resolve(databaseUrl.slice('file:'.length));
const requestedDestination = process.argv[2];
const timestamp = new Date()
  .toISOString()
  .replaceAll(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');
const destinationPath = requestedDestination
  ? path.resolve(requestedDestination)
  : path.join(path.dirname(sourcePath), `bud-backup-${timestamp}.db`);

if (sourcePath === destinationPath) {
  throw new Error('Backup destination must differ from the source database.');
}

async function inspectDatabase(filePath) {
  const client = createClient({ url: toFileUrl(filePath) });
  try {
    const integrity = await client.execute('PRAGMA integrity_check');
    const integrityResult = String(integrity.rows[0]?.integrity_check ?? 'unknown');
    if (integrityResult !== 'ok') {
      throw new Error(`Integrity check failed for ${filePath}: ${integrityResult}`);
    }

    const tableList = await client.execute({
      sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${applicationTables
        .map(() => '?')
        .join(', ')})`,
      args: applicationTables,
    });
    const tables = tableList.rows.map((row) => String(row.name));
    const counts = {};
    for (const table of tables) {
      const result = await client.execute(`SELECT COUNT(*) AS count FROM "${table}"`);
      counts[table] = Number(result.rows[0]?.count ?? 0);
    }
    return counts;
  } finally {
    client.close();
  }
}

const sourceCounts = await inspectDatabase(sourcePath);
try {
  await access(destinationPath);
  throw new Error(`Backup destination already exists: ${destinationPath}`);
} catch (error) {
  if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error;
}
const sourceClient = createClient({ url: toFileUrl(sourcePath) });
try {
  const escapedDestination = destinationPath.replaceAll('\\', '/').replaceAll("'", "''");
  await sourceClient.execute(`VACUUM INTO '${escapedDestination}'`);
} finally {
  sourceClient.close();
}
const backupCounts = await inspectDatabase(destinationPath);

if (JSON.stringify(sourceCounts) !== JSON.stringify(backupCounts)) {
  throw new Error('Backup verification failed: table counts do not match the source database.');
}

const backupStats = await stat(destinationPath);
console.log(`Verified backup: ${destinationPath}`);
console.log(`Size: ${backupStats.size} bytes`);
console.log(`Rows: ${JSON.stringify(backupCounts)}`);
