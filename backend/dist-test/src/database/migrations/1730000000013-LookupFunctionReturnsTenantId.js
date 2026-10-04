"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LookupFunctionReturnsTenantId1730000000013 = void 0;
class LookupFunctionReturnsTenantId1730000000013 {
    name = 'LookupFunctionReturnsTenantId1730000000013';
    async up(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS find_or_create_customer_by_phone(VARCHAR);`);
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
        await queryRunner.query(`REVOKE ALL ON FUNCTION find_or_create_customer_by_phone(VARCHAR) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION find_or_create_customer_by_phone(VARCHAR) TO beauty_app;`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS find_or_create_customer_by_phone(VARCHAR);`);
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
        await queryRunner.query(`REVOKE ALL ON FUNCTION find_or_create_customer_by_phone(VARCHAR) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION find_or_create_customer_by_phone(VARCHAR) TO beauty_app;`);
    }
}
exports.LookupFunctionReturnsTenantId1730000000013 = LookupFunctionReturnsTenantId1730000000013;
