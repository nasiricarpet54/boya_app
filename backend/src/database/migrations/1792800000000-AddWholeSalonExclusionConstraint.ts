import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWholeSalonExclusionConstraint1792800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable btree_gist extension for mixed = and && operators
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

        // Drop existing partial index if exists (for clean migration)
        await queryRunner.query(`DROP INDEX IF EXISTS IX_schedule_blocks_whole_salon`);

        // Add partial exclusion constraint for whole-salon blocks
        // This ONLY applies when both tenant_id and specialist_id are NULL
        await queryRunner.query(`
            ALTER TABLE schedule_blocks 
            ADD CONSTRAINT EX_schedule_blocks_whole_salon
            EXCLUDE USING gist (
                tstzrange(start_time, end_time, '[)') WITH &&
            ) 
            WHERE (tenant_id IS NULL AND specialist_id IS NULL)
        `);

        // Create B-tree index for tenant visibility checks
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_schedule_blocks_tenant_visibility 
            ON schedule_blocks (tenant_id, start_time, end_time) 
            WHERE specialist_id IS NOT NULL AND active IS TRUE
        `);

        // Create B-tree index for mobile specialists
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_schedule_blocks_mobile_visibility 
            ON schedule_blocks (specialist_id, start_time, end_time) 
            WHERE tenant_id IS NULL
        `);

        // Verify constraint exists
        const constraints = await queryRunner.query(`
            SELECT conname 
            FROM pg_constraint 
            WHERE conname LIKE 'EX_schedule_blocks%'
        `);

        console.log('Constraints created:', constraints);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the partial constraint
        await queryRunner.query(`
            ALTER TABLE schedule_blocks 
            DROP CONSTRAINT IF EXISTS EX_schedule_blocks_whole_salon
        `);

        // Drop associated index
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_schedule_blocks_whole_salon
        `);

        // Drop B-tree indexes created for optimization
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_schedule_blocks_tenant_visibility
        `);
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_schedule_blocks_mobile_visibility
        `);

        // Drop the extension if it's no longer needed (but might be used elsewhere)
        await queryRunner.query(`
            DROP EXTENSION IF EXISTS btree_gist
        `);
    }
}
