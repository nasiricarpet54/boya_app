"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerLookupFunction1730000000008 = void 0;
class CustomerLookupFunction1730000000008 {
    name = 'CustomerLookupFunction1730000000008';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION find_or_create_customer_by_phone(
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
    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS find_or_create_customer_by_phone(VARCHAR);`);
    }
}
exports.CustomerLookupFunction1730000000008 = CustomerLookupFunction1730000000008;
