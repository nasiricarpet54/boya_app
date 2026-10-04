"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlignServiceAndSpecialistSchema1730000000012 = void 0;
class AlignServiceAndSpecialistSchema1730000000012 {
    name = 'AlignServiceAndSpecialistSchema1730000000012';
    async up(queryRunner) {
        await this.alignServices(queryRunner);
        await this.alignSpecialists(queryRunner);
        await this.seedSpecialists(queryRunner);
    }
    async alignServices(queryRunner) {
        await queryRunner.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 60`);
        await queryRunner.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_services_tenant_active ON services(tenant_id, is_active)`);
    }
    async alignSpecialists(queryRunner) {
        await queryRunner.query(`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS bio TEXT`);
        await queryRunner.query(`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) NOT NULL DEFAULT 50`);
        await queryRunner.query(`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_specialists_tenant_id ON specialists(tenant_id)`);
    }
    async seedSpecialists(queryRunner) {
        await queryRunner.query(`
      INSERT INTO users (id, tenant_id, phone, full_name, role, is_active)
      SELECT
        md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid,
        x.tenant_id,
        '0913' || lpad(x.ord::text, 7, '0'),
        'متخصص نمونه ' || x.g,
        'specialist',
        true
      FROM (
        SELECT t.id AS tenant_id,
               g,
               (row_number() OVER (ORDER BY t.id) - 1) * 3 + g AS ord
        FROM tenants t
        CROSS JOIN generate_series(1, 3) AS g
      ) x
      ON CONFLICT DO NOTHING
    `);
        await queryRunner.query(`
      INSERT INTO specialists (id, tenant_id, user_id, bio, skills, commission_rate, is_active)
      SELECT
        md5(x.tenant_id::text || ':spec:' || x.g)::uuid,
        x.tenant_id,
        md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid,
        CASE x.g
          WHEN 1 THEN 'متخصص رنگ و مش با هشت سال سابقه کار در سالن‌های تهران.'
          WHEN 2 THEN 'متخصص کراتین و احیای مو، دارای گواهی بین‌المللی.'
          ELSE 'متخصص کوتاهی و براشینگ مو، مسلط به جدیدترین مدل‌ها.'
        END,
        CASE x.g
          WHEN 1 THEN '["رنگ مو","مش","هایلایت"]'::jsonb
          WHEN 2 THEN '["کراتین","احیا مو"]'::jsonb
          ELSE '["کوتاهی مو","براشینگ"]'::jsonb
        END,
        (54 + x.g * 5)::numeric(5, 2),
        true
      FROM (
        SELECT t.id AS tenant_id, g
        FROM tenants t
        CROSS JOIN generate_series(1, 3) AS g
      ) x
      JOIN users u ON u.id = md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid
      ON CONFLICT DO NOTHING
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DELETE FROM specialists
      WHERE id IN (
        SELECT md5(x.tenant_id::text || ':spec:' || x.g)::uuid
        FROM (SELECT t.id AS tenant_id, g FROM tenants t CROSS JOIN generate_series(1, 3) AS g) x
      )
    `);
        await queryRunner.query(`
      DELETE FROM users
      WHERE id IN (
        SELECT md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid
        FROM (SELECT t.id AS tenant_id, g FROM tenants t CROSS JOIN generate_series(1, 3) AS g) x
      )
    `);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_services_tenant_active`);
        await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS is_active`);
        await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS duration_minutes`);
        await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS is_active`);
        await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS commission_rate`);
        await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS skills`);
        await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS bio`);
    }
}
exports.AlignServiceAndSpecialistSchema1730000000012 = AlignServiceAndSpecialistSchema1730000000012;
