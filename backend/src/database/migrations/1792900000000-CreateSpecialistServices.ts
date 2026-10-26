import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The services a salon owner has assigned to each specialist.
 *
 * A booking (specialist, service) pair is only valid when a row exists here and
 * `is_active` is true, so a specialist never shows up next to a service the
 * salon never assigned them — that is the contract the customer app's booking
 * form and `POST /bookings` both enforce.
 *
 * - `price`/`duration_minutes` are nullable on purpose: NULL means "use the
 *   `services` defaults", so assigning a service needs no per-specialist copy.
 * - RLS is `ENABLE + FORCE` on `tenant_id = app.current_tenant_id` exactly like
 *   the other tenant tables (migration 1730000000027 pattern), so panel reads
 *   and writes stay inside the transaction that sets the GUC.
 * - The public catalogue (no tenant context) reads through
 *   `get_public_specialist_services()`, the SECURITY DEFINER escape hatch every
 *   other public lookup (1730000000014/15/16) already uses. `GRANT` is explicit
 *   because `GRANT ... ON ALL TABLES` (1792850000000) covers only tables that
 *   existed when it ran.
 */
export class CreateSpecialistServices1792900000000 implements MigrationInterface {
  name = 'CreateSpecialistServices1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS specialist_services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        price NUMERIC(12, 0),
        duration_minutes INT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT specialist_services_unique UNIQUE (tenant_id, specialist_id, service_id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_specialist_services_tenant_active
        ON specialist_services (tenant_id, specialist_id, is_active);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_specialist_services_tenant_service
        ON specialist_services (tenant_id, service_id);
    `);

    await queryRunner.query(`
      ALTER TABLE specialist_services ENABLE ROW LEVEL SECURITY;
      ALTER TABLE specialist_services FORCE ROW LEVEL SECURITY;
    `);

    await queryRunner.query(`
      CREATE POLICY specialist_services_tenant_isolation ON specialist_services
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON specialist_services TO beauty_app;`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_public_specialist_services(
        p_tenant_id UUID,
        p_specialist_id UUID
      )
      RETURNS TABLE (
        service_id UUID,
        name VARCHAR,
        description TEXT,
        price NUMERIC,
        duration_minutes INT,
        is_mobile_available BOOLEAN
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT sv.id,
               sv.name,
               sv.description,
               COALESCE(ss.price, sv.price),
               COALESCE(ss.duration_minutes, sv.duration_minutes),
               sv.is_mobile_available
        FROM specialist_services ss
        JOIN services sv ON sv.id = ss.service_id
        WHERE ss.tenant_id = p_tenant_id
          AND ss.specialist_id = p_specialist_id
          AND ss.is_active = true
          AND sv.is_active = true
        ORDER BY sv.name ASC, sv.id ASC
      $$;
    `);

    await queryRunner.query(
      `REVOKE ALL ON FUNCTION get_public_specialist_services(UUID, UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION get_public_specialist_services(UUID, UUID) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_public_specialist_services(UUID, UUID)`);
    await queryRunner.query(`DROP POLICY IF EXISTS specialist_services_tenant_isolation ON specialist_services`);
    await queryRunner.query(`ALTER TABLE specialist_services NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE specialist_services DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_specialist_services_tenant_service`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_specialist_services_tenant_active`);
    await queryRunner.query(`DROP TABLE IF EXISTS specialist_services`);
  }
}
