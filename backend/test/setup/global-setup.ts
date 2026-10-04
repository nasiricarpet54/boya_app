import {
  adminConfig,
  canReachPostgres,
  clearReadyMarker,
  createTestDatabaseIfMissing,
  grantAppRoleOnTestDatabase,
  markReady,
  runMigrationsOnTestDatabase,
  TEST_DB_NAME,
} from './test-db';

/**
 * Jest `globalSetup` for the integration suite.
 *
 * 1. Probe Postgres. When it is unreachable the run is marked as skipped
 *    (no marker file) and every integration suite turns into `describe.skip`
 *    instead of failing.
 * 2. Create `beauty_platform_test` when missing.
 * 3. Run the real migration chain on it.
 * 4. Grant the `beauty_app` role, so the RLS-subject connection can read and
 *    write under the policies.
 */
export default async function globalSetup(): Promise<void> {
  clearReadyMarker();

  if (!(await canReachPostgres())) {
    // eslint-disable-next-line no-console
    console.warn(
      `[integration] SKIPPED: postgres unreachable at ${String(adminConfig.host)}:${String(adminConfig.port)}`,
    );
    return;
  }

  await createTestDatabaseIfMissing();
  await runMigrationsOnTestDatabase();
  await grantAppRoleOnTestDatabase();
  markReady();

  // eslint-disable-next-line no-console
  console.log(`[integration] ${TEST_DB_NAME} is migrated and ready`);
}
