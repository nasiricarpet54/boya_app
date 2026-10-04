import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Approval system schema.
 * Adds approval_status enum and columns to tenants, service_lines, specialists.
 * Tracks pending_changes on tenants for edit proposals.
 */
export class ApprovalSchema1730000000018 implements MigrationInterface {
  name = 'ApprovalSchema1730000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the approval_status enum
    await queryRunner.query(`
      CREATE TYPE approval_status AS ENUM (
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'suspended'
      )
    `);

    // Add columns to tenants
    await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN status approval_status NOT NULL DEFAULT 'draft',
        ADD COLUMN rejection_reason TEXT NULL,
        ADD COLUMN approved_at TIMESTAMPTZ NULL,
        ADD COLUMN approved_by UUID NULL REFERENCES users(id),
        ADD COLUMN pending_changes JSONB NULL
    `);

    // Add columns to service_lines
    await queryRunner.query(`
      ALTER TABLE service_lines
        ADD COLUMN status approval_status NOT NULL DEFAULT 'draft',
        ADD COLUMN rejection_reason TEXT NULL,
        ADD COLUMN approved_at TIMESTAMPTZ NULL,
        ADD COLUMN approved_by UUID NULL REFERENCES users(id)
    `);

    // Add columns to specialists
    await queryRunner.query(`
      ALTER TABLE specialists
        ADD COLUMN status approval_status NOT NULL DEFAULT 'draft',
        ADD COLUMN rejection_reason TEXT NULL,
        ADD COLUMN approved_at TIMESTAMPTZ NULL,
        ADD COLUMN approved_by UUID NULL REFERENCES users(id)
    `);

    // Create indexes for status filtering
    await queryRunner.query(`CREATE INDEX idx_tenants_status ON tenants(status)`);
    await queryRunner.query(`CREATE INDEX idx_service_lines_status ON service_lines(status)`);
    await queryRunner.query(`CREATE INDEX idx_specialists_status ON specialists(status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_specialists_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_service_lines_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_status`);

    // Drop columns from specialists
    await queryRunner.query(`
      ALTER TABLE specialists
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS rejection_reason,
        DROP COLUMN IF EXISTS status
    `);

    // Drop columns from service_lines
    await queryRunner.query(`
      ALTER TABLE service_lines
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS rejection_reason,
        DROP COLUMN IF EXISTS status
    `);

    // Drop columns from tenants
    await queryRunner.query(`
      ALTER TABLE tenants
        DROP COLUMN IF EXISTS pending_changes,
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS rejection_reason,
        DROP COLUMN IF EXISTS status
    `);

    // Drop the enum
    await queryRunner.query(`DROP TYPE IF EXISTS approval_status`);
  }
}