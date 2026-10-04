import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

import { createPgClient, PgConfig } from './pg-client';

/**
 * Everything the integration harness needs to reach Postgres, create a private
 * test database, migrate it and hand the result to the specs.
 *
 * The harness never touches the development database: it always talks to
 * `beauty_platform_test`.
 */

export const TEST_DB_NAME = process.env.TEST_DATABASE_NAME ?? 'beauty_platform_test';

/** Marker written by globalSetup when the test database is migrated and usable. */
export const READY_MARKER = resolve(__dirname, '.integration-ready');

const DB_HOST = process.env.DATABASE_MIGRATION_HOST ?? process.env.DATABASE_HOST ?? 'localhost';
const DB_PORT = Number(process.env.DATABASE_MIGRATION_PORT ?? process.env.DATABASE_PORT ?? 5433);
const DB_ADMIN_USER = process.env.DATABASE_MIGRATION_USER ?? 'beauty';
const DB_ADMIN_PASSWORD = process.env.DATABASE_MIGRATION_PASSWORD ?? process.env.DATABASE_PASSWORD ?? 'change-me';
const DB_ADMIN_NAME = process.env.DATABASE_MIGRATION_NAME ?? process.env.DATABASE_NAME ?? 'beauty_platform';

/**
 * `beauty_app` is the RLS-subject role (NOBYPASSRLS). Every isolation
 * assertion runs as it, because `beauty` is a superuser and would bypass RLS.
 */
export const APP_ROLE = process.env.TEST_APP_USER ?? process.env.DATABASE_USER ?? 'beauty_app';
const APP_PASSWORD = process.env.TEST_APP_PASSWORD ?? process.env.DATABASE_PASSWORD ?? 'app_password_dev';

/** Superuser connection: migrations, fixtures, catalogue reads. */
export const adminConfig: PgConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_ADMIN_USER,
  password: DB_ADMIN_PASSWORD,
  database: DB_ADMIN_NAME,
};

/** RLS-subject connection, pointed at the test database. */
export const appConfig: PgConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: APP_ROLE,
  password: APP_PASSWORD,
  database: TEST_DB_NAME,
};

export function markReady(): void {
  writeFileSync(READY_MARKER, new Date().toISOString(), 'utf8');
}

export function clearReadyMarker(): void {
  rmSync(READY_MARKER, { force: true });
}

/** True when globalSetup managed to prepare the test database. */
export function isReady(): boolean {
  return existsSync(READY_MARKER);
}

export async function canReachPostgres(): Promise<boolean> {
  const client = createPgClient({ ...adminConfig, database: 'postgres', connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[integration] probe failed: ${(error as Error).message}`);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function createTestDatabaseIfMissing(): Promise<void> {
  const client = createPgClient({ ...adminConfig, database: 'postgres' });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Runs the real migration chain against the test database. `ts-node` is
 * registered because TypeORM loads the `.ts` migration files itself (the same
 * way `npm run migration:run` does).
 */
export async function runMigrationsOnTestDatabase(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('ts-node').register({ transpileOnly: true });

  const dataSource = new DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_ADMIN_USER,
    password: DB_ADMIN_PASSWORD,
    database: TEST_DB_NAME,
    entities: [],
    synchronize: false,
    migrations: [resolve(__dirname, '../../src/database/migrations/*.ts')],
    migrationsTableName: 'migrations',
  });

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}

/**
 * A database created after the container's init script has none of its
 * `ALTER DEFAULT PRIVILEGES`, so the app role is granted explicitly.
 */
export async function grantAppRoleOnTestDatabase(): Promise<void> {
  const client = createPgClient({ ...adminConfig, database: TEST_DB_NAME });
  await client.connect();
  try {
    await client.query(`GRANT CONNECT ON DATABASE "${TEST_DB_NAME}" TO ${APP_ROLE}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`,
    );
  } finally {
    await client.end();
  }
}
