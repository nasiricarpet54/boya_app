"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalSchema1730000000018 = void 0;
class ApprovalSchema1730000000018 {
    name = 'ApprovalSchema1730000000018';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TYPE approval_status AS ENUM (
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'suspended'
      )
    `);
        await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN status approval_status NOT NULL DEFAULT 'draft',
        ADD COLUMN rejection_reason TEXT NULL,
        ADD COLUMN approved_at TIMESTAMPTZ NULL,
        ADD COLUMN approved_by UUID NULL REFERENCES users(id),
        ADD COLUMN pending_changes JSONB NULL
    `);
        await queryRunner.query(`
      ALTER TABLE service_lines
        ADD COLUMN status approval_status NOT NULL DEFAULT 'draft',
        ADD COLUMN rejection_reason TEXT NULL,
        ADD COLUMN approved_at TIMESTAMPTZ NULL,
        ADD COLUMN approved_by UUID NULL REFERENCES users(id)
    `);
        await queryRunner.query(`
      ALTER TABLE specialists
        ADD COLUMN status approval_status NOT NULL DEFAULT 'draft',
        ADD COLUMN rejection_reason TEXT NULL,
        ADD COLUMN approved_at TIMESTAMPTZ NULL,
        ADD COLUMN approved_by UUID NULL REFERENCES users(id)
    `);
        await queryRunner.query(`CREATE INDEX idx_tenants_status ON tenants(status)`);
        await queryRunner.query(`CREATE INDEX idx_service_lines_status ON service_lines(status)`);
        await queryRunner.query(`CREATE INDEX idx_specialists_status ON specialists(status)`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_specialists_status`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_service_lines_status`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_status`);
        await queryRunner.query(`
      ALTER TABLE specialists
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS rejection_reason,
        DROP COLUMN IF EXISTS status
    `);
        await queryRunner.query(`
      ALTER TABLE service_lines
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS rejection_reason,
        DROP COLUMN IF EXISTS status
    `);
        await queryRunner.query(`
      ALTER TABLE tenants
        DROP COLUMN IF EXISTS pending_changes,
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS rejection_reason,
        DROP COLUMN IF EXISTS status
    `);
        await queryRunner.query(`DROP TYPE IF EXISTS approval_status`);
    }
}
exports.ApprovalSchema1730000000018 = ApprovalSchema1730000000018;
