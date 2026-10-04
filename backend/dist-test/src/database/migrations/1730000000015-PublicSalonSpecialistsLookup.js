"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicSalonSpecialistsLookup1730000000015 = void 0;
class PublicSalonSpecialistsLookup1730000000015 {
    name = 'PublicSalonSpecialistsLookup1730000000015';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_public_salon_specialists(
        p_tenant_id UUID
      )
      RETURNS TABLE (
        id UUID,
        full_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        skills JSONB,
        commission_rate NUMERIC
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT sp.id,
               u.full_name::TEXT,
               u.avatar_url::TEXT,
               sp.bio,
               sp.skills,
               sp.commission_rate
        FROM specialists sp
        LEFT JOIN users u ON u.id = sp.user_id
        WHERE sp.tenant_id = p_tenant_id
          AND sp.is_active = true
        ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC
      $$;
    `);
        await queryRunner.query(`REVOKE ALL ON FUNCTION get_public_salon_specialists(UUID) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION get_public_salon_specialists(UUID) TO beauty_app;`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS get_public_salon_specialists(UUID)`);
    }
}
exports.PublicSalonSpecialistsLookup1730000000015 = PublicSalonSpecialistsLookup1730000000015;
