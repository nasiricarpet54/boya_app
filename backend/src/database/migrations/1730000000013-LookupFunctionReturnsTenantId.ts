import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The OTP login must be able to tell which salon a user belongs to, because the
 * JWT is what every tenant-scoped authorisation check reads
 * (`BookingService.requireApprover` refuses to act without a tenantId).
 *
 * Reading `users.tenant_id` from application code is not an option: `users` is
 * `ENABLE + FORCE ROW LEVEL SECURITY` behind `users_tenant_isolation`
 * (`tenant_id = app.current_tenant_id`), and the login request has no tenant
 * context yet — that is exactly the fact it is trying to discover. A plain
 * SELECT as `beauty_app` therefore sees zero rows.
 *
 * The fix widens nothing: the lookup stays inside the SECURITY DEFINER function
 * introduced by 1730000000008, which is the same escape hatch
 * `get_public_salon_tags()` uses in 1730000000009. It stays non-PUBLIC and
 * executable only by the backend role, and the only code path that reaches it
 * is `/auth/otp/verify`, *after* a valid OTP for that exact phone number has
 * been consumed — so a caller can only ever learn the tenant of a number they
 * control. No RLS policy on `users` (or any other table) is created, altered or
 * relaxed here.
 *
 * `CREATE OR REPLACE FUNCTION` cannot change the OUT column list of an existing
 * function, so the old signature has to be dropped first.
 */
export class LookupFunctionReturnsTenantId1730000000013
  implements MigrationInterface
{
  name = 'LookupFunctionReturnsTenantId1730000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS find_or_create_customer_by_phone(VARCHAR);`,
    );

    await queryRunner.query(`
      CREATE FUNCTION find_or_create_customer_by_phone(
        p_phone VARCHAR
      )
      RETURNS TABLE (
        id UUID,
        phone VARCHAR,
        full_name VARCHAR,
        role VARCHAR,
        is_new BOOLEAN,
        tenant_id UUID
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_id UUID;
        v_full_name VARCHAR;
        v_role VARCHAR;
        v_tenant_id UUID;
        v_is_new BOOLEAN := false;
      BEGIN
        -- New customers are created without a salon; staff rows already carry
        -- the tenant_id their salon admin provisioned.
        SELECT u.id, u.full_name, u.role, u.tenant_id
          INTO v_id, v_full_name, v_role, v_tenant_id
          FROM users u
          WHERE u.phone = p_phone
          LIMIT 1;

        IF v_id IS NULL THEN
          INSERT INTO users (phone, role)
          VALUES (p_phone, 'customer')
          RETURNING users.id, users.full_name, users.role, users.tenant_id
          INTO v_id, v_full_name, v_role, v_tenant_id;
          v_is_new := true;
        END IF;

        RETURN QUERY SELECT v_id, p_phone, v_full_name, v_role, v_is_new, v_tenant_id;
      END;
      $$;
    `);

    await queryRunner.query(
      `REVOKE ALL ON FUNCTION find_or_create_customer_by_phone(VARCHAR) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION find_or_create_customer_by_phone(VARCHAR) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the 5-column signature from 1730000000008.
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS find_or_create_customer_by_phone(VARCHAR);`,
    );

    await queryRunner.query(`
      CREATE FUNCTION find_or_create_customer_by_phone(
        p_phone VARCHAR
      )
      RETURNS TABLE (
        id UUID,
        phone VARCHAR,
        full_name VARCHAR,
        role VARCHAR,
        is_new BOOLEAN
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_id UUID;
        v_full_name VARCHAR;
        v_role VARCHAR;
        v_is_new BOOLEAN := false;
      BEGIN
        SELECT u.id, u.full_name, u.role
          INTO v_id, v_full_name, v_role
          FROM users u
          WHERE u.phone = p_phone
          LIMIT 1;

        IF v_id IS NULL THEN
          INSERT INTO users (phone, role)
          VALUES (p_phone, 'customer')
          RETURNING users.id, users.full_name, users.role
          INTO v_id, v_full_name, v_role;
          v_is_new := true;
        END IF;

        RETURN QUERY SELECT v_id, p_phone, v_full_name, v_role, v_is_new;
      END;
      $$;
    `);

    await queryRunner.query(
      `REVOKE ALL ON FUNCTION find_or_create_customer_by_phone(VARCHAR) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION find_or_create_customer_by_phone(VARCHAR) TO beauty_app;`,
    );
  }
}
