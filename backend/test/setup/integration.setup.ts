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

/**
 * When `INTEGRATION_DB_REQUIRED === 'true'` (set by CI) a missing Postgres is a
 * hard failure instead of a silent skip: a green build must mean the isolation
 * specs actually ran. Locally the flag stays unset, so `npm run test:integration`
 * keeps working without docker.
 */
export const integrationRequired = process.env.INTEGRATION_DB_REQUIRED === 'true';

/** `describe` when the database is ready; otherwise skip, or fail when required. */
export const describeIntegration = integrationEnabled
  ? describe
  : integrationRequired
    ? (name: string, fn: () => void) =>
        describe(name, () => {
          // Fail before the spec body registers its own hooks, so the report is
          // a single clear failure instead of hook noise from an empty DataSource.
          beforeAll(() => {
            throw new Error(
              '[integration] Postgres is unreachable but INTEGRATION_DB_REQUIRED=true — the suite must not pass silently',
            );
          });
          fn();
        })
    : describe.skip;

let dataSource: DataSource | null = null;
let adminDataSource: DataSource | null = null;

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

    // A second connection as the migration owner. The application itself runs
    // as this role, so specs that must mirror production behaviour (anything
    // resolving a row from a credential, before any RLS context exists) use
    // this one rather than the NOBYPASSRLS role above.
    adminDataSource = new DataSource({
      type: 'postgres',
      host: String(adminConfig.host),
      port: Number(adminConfig.port),
      username: String(adminConfig.user),
      password: String(adminConfig.password),
      database: TEST_DB_NAME,
      entities: [],
      synchronize: false,
    });
    await adminDataSource.initialize();
  }, 30_000);

afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (adminDataSource?.isInitialized) {
      await adminDataSource.destroy();
    }
    dataSource = null;
    adminDataSource = null;
});

/**
 * The migration-owner DataSource — the role the application itself connects as.
 * Use it for specs that must reproduce production access, and `getDataSource()`
 * for the RLS-isolation assertions that must not bypass any policy.
 */
export function getAdminDataSource(): DataSource {
  if (!adminDataSource?.isInitialized) {
    throw new Error('integration admin DataSource is not initialised (was the suite skipped?)');
  }
  return adminDataSource;
}

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
    await manager.query(`SELECT set_config('app.current_role', 'admin', true)`);
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

/**
 * Runs `work` in one transaction that sets the tenant, user and role GUC exactly like
 * `setTenantContext`, `setUserContext`, `setRoleContext` does in the application (`set_config(..., true)`).
 */
export async function withTenantAndUserAndRole<T>(
  tenantId: string,
  userId: string,
  role: string,
  work: (query: <R>(sql: string, params?: unknown[]) => Promise<R>) => Promise<T>,
): Promise<T> {
  const dataSource = getDataSource();
  return dataSource.transaction(async (manager) => {
    await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await manager.query(`SELECT set_config('app.current_role', 'admin', true)`);
    await manager.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    await manager.query(`SELECT set_config('app.current_role', $1, true)`, [role]);
    return work(<R>(sql: string, params?: unknown[]) => manager.query<R>(sql, params));
  });
}
