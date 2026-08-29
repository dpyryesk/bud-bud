import 'dotenv/config';

import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { hasApplicationSchema } from './database-schema.mjs';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/bud.db';
if (!databaseUrl.startsWith('file:')) {
  console.error('Safe migration currently supports file-backed SQLite databases only.');
  process.exit(1);
}

const databasePath = path.resolve(databaseUrl.slice('file:'.length));
let databaseExists = false;
try {
  databaseExists = (await stat(databasePath)).size > 0;
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

if (databaseExists && (await hasApplicationSchema(databasePath))) {
  const backup = spawnSync(process.execPath, ['scripts/backup-database.mjs'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (backup.status !== 0) process.exit(backup.status ?? 1);
}

const prismaCli = path.resolve('node_modules', 'prisma', 'build', 'index.js');
await access(prismaCli);
const migration = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});
if (migration.error) console.error(migration.error);
process.exit(migration.status ?? 1);
