import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

// Load .env from backend/ regardless of CWD
loadEnv({ path: resolve(__dirname, '../../.env') });

const host = process.env.DATABASE_MIGRATION_HOST ?? process.env.DATABASE_HOST ?? 'localhost';
const port = Number(
  process.env.DATABASE_MIGRATION_PORT ?? process.env.DATABASE_PORT ?? 5432,
);
const username =
  process.env.DATABASE_MIGRATION_USER ?? process.env.DATABASE_USER ?? 'beauty';
const password =
  process.env.DATABASE_MIGRATION_PASSWORD ?? process.env.DATABASE_PASSWORD ?? '';
const database =
  process.env.DATABASE_MIGRATION_NAME ?? process.env.DATABASE_NAME ?? 'beauty_platform';

if (username === 'beauty_app') {
  throw new Error(
    '[migration DataSource] Loaded DATABASE_USER=beauty_app. ' +
    'Migrations must run as the master user. Check that backend/.env ' +
    'exists and DATABASE_MIGRATION_USER is set.',
  );
}

// eslint-disable-next-line no-console
console.log(`[migration DataSource] connecting as ${username}@${host}:${port}/${database}`);

export default new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  synchronize: false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  // Per-migration transactions: the backfill in 1730000000040 opts out
  // (`transaction = false`) to avoid holding locks across a bulk UPDATE, and
  // the default `'all'` rejects any such override outright, so the chain could
  // not run against a fresh database at all.
  migrationsTransactionMode: 'each',
});

