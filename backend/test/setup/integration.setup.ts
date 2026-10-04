import { DataSource } from 'typeorm';

import { createPgClient } from './pg-client';
import { adminConfig, appConfig, isReady, TEST_DB_NAME } from './test-db';

/**
 * Shared wiring for the integration specs (`setupFilesAfterEnv`).
 *
 * `global-setup.ts` probes Postgres, creates `beauty_platform_test`, runs every
 * migration and grants the app role; it records the outcome in a marker file.
 * When the marker is missing the whole suite is skipped rather than failed, so
 * `npm run test:integration` stays green on a machine without docker.
 */
export const integrationEnabled = isReady();

/** `describe` when the database is ready, `describe.skip` otherwise. */
export const describeIntegration = integrationEnabled ? describe : describe.skip;

let dataSource: DataSource | null = null;

beforeAll(async () => {
  if (!integrationEnabled) {
    // eslint-disable-next-line no-console
    console.warn('[integration] skipped: no reachable postgres (start docker + run migrations)');
    return;
  }

  dataSource = new DataSource({
    type: 'postgres',
    host: String(appConfig.host),
    port: Number(appConfig.port),
    username: String(appConfig.user),
    password: String(appConfig.password),
    database: TEST_DB_NAME,
    entities: [],
    synchronize: false,
  });
  await dataSource.initialize();
}, 30_000);

afterAll(async () => {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
  dataSource = null;
});

/** The connected RLS-subject DataSource; only valid inside a spec. */
export function getDataSource(): DataSource {
  if (!dataSource?.isInitialized) {
    throw new Error('integration DataSource is not initialised (was the suite skipped?)');
  }
  return dataSource;
}

/**
 * Runs `work` in one transaction that sets the tenant GUC exactly like
 * `setTenantContext` does in the application (`set_config(..., true)`).
 */
export async function withTenant<T>(
  tenantId: string,
  work: (query: <R>(sql: string, params?: unknown[]) => Promise<R>) => Promise<T>,
): Promise<T> {
  const dataSource = getDataSource();
  return dataSource.transaction(async (manager) => {
    await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    return work(<R>(sql: string, params?: unknown[]) => manager.query<R>(sql, params));
  });
}

/** Catalogue reads (e.g. `pg_policies`) through the superuser connection. */
export async function queryAsAdmin<R extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  const client = createPgClient({ ...adminConfig, database: TEST_DB_NAME });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as R[];
  } finally {
    await client.end();
  }
}
