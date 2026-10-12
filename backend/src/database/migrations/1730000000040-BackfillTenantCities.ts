import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill pre-existing tenants with a default location (Tehran).
 *
 * `province_id` / `city_id` were added to `tenants` in 1730000000038 as nullable
 * columns, so every salon created before that migration has neither. New code
 * that reads `tenants.city_id` (search, filtering, distance) would see NULL for
 * those rows, so they are pinned to Tehran/Tehran — the city every existing
 * salon was assumed to be in when the seed went out.
 *
 * The ids are resolved by code (`THR` / `THR-TEH`) rather than hardcoded UUIDs:
 * the seed in 1730000000039 generates ids with gen_random_uuid(), so they differ
 * per environment while the codes are stable and UNIQUE.
 *
 * `tenants` carries no RLS (see docs/report/02-database-rls.md), so this UPDATE
 * touches every row regardless of `app.current_tenant_id` — which is exactly
 * what a one-off cross-tenant backfill needs.
 *
 * `transaction = false`: on large databases a single bulk UPDATE keeps locks
 * held for the whole statement, so it runs outside a migration transaction.
 *
 * Not reversible: once a salon is told it is in Tehran, there is no record of
 * where it was before, so `down()` is a deliberate no-op.
 */
export class BackfillTenantCities1730000000040 implements MigrationInterface {
  name = 'BackfillTenantCities1730000000040';
  transaction = false; // ایمنی برای محیط‌های بزرگ

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tenants
      SET
        province_id = (SELECT id FROM provinces WHERE code = 'THR'),
        city_id = (SELECT id FROM cities
                   WHERE code = 'THR-TEH'
                     AND province_id = (SELECT id FROM provinces WHERE code = 'THR'))
      WHERE city_id IS NULL
    `);
  }

  public async down(): Promise<void> {
    // no-op — backfill قابل برگشت نیست
  }
}
