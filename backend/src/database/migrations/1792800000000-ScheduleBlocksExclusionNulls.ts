import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PostgreSQL exclusion constraints do not consider NULL values equal. The
 * mobile-schedule migration therefore left overlapping whole-salon and mobile
 * blocks unconstrained. Normalize both nullable UUID dimensions to a reserved
 * sentinel so the same GiST exclusion rule covers those rows too.
 *
 * Existing conflicting rows are not silently deleted or merged: if any are
 * found, the migration stops with an actionable error and an operator can
 * resolve them without losing schedule data.
 */
export class ScheduleBlocksExclusionNulls1792800000000 implements MigrationInterface {
  name = 'ScheduleBlocksExclusionNulls1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
            FROM schedule_blocks a
            JOIN schedule_blocks b
              ON a.ctid <> b.ctid
             AND COALESCE(a.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
                 = COALESCE(b.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             AND COALESCE(a.specialist_id, '00000000-0000-0000-0000-000000000000'::uuid)
                 = COALESCE(b.specialist_id, '00000000-0000-0000-0000-000000000000'::uuid)
             AND tstzrange(a.start_time, a.end_time, '[)')
                 && tstzrange(b.start_time, b.end_time, '[)')
        ) THEN
          RAISE EXCEPTION
            'Cannot install schedule-block exclusion constraint: overlapping rows already exist for a NULL-key schedule group. Resolve duplicate blocks, then rerun migrations.'
            USING ERRCODE = '23514';
        END IF;
      END;
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE schedule_blocks
        DROP CONSTRAINT IF EXISTS ex_schedule_blocks_no_overlap
    `);
    await queryRunner.query(`
      ALTER TABLE schedule_blocks
        ADD CONSTRAINT ex_schedule_blocks_no_overlap
        EXCLUDE USING gist (
          (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
          (COALESCE(specialist_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
          tstzrange(start_time, end_time, '[)') WITH &&
        )
        WITH (fillfactor = 70)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE schedule_blocks
        DROP CONSTRAINT IF EXISTS ex_schedule_blocks_no_overlap
    `);
    await queryRunner.query(`
      ALTER TABLE schedule_blocks
        ADD CONSTRAINT ex_schedule_blocks_no_overlap
        EXCLUDE USING gist (
          tenant_id WITH =,
          specialist_id WITH =,
          tstzrange(start_time, end_time, '[)') WITH &&
        )
        WITH (fillfactor = 70)
    `);
  }
}
