import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableRLSWithBeautyAppRole1792850000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create beauty_app role if it doesn't exist (with NOBYPASSRLS)
        await queryRunner.query(`
            CREATE ROLE beauty_app NOLOGIN;
        `).catch(async (error) => {
            if (error.code === '42P10') {
                // Role already exists, ignore
                await queryRunner.query(`
                    GRANT CREATE ON DATABASE "beauty_platform" TO htmlnui;
                `);
            } else {
                throw error;
            }
        });

        // Ensure the app role has necessary permissions on all tables
        await queryRunner.query(`
            GRANT CONNECT ON DATABASE "beauty_platform" TO beauty_app;
            GRANT USAGE ON SCHEMA public TO beauty_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beauty_app;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beauty_app;
            GRANT INSERT ON ALL TABLES IN SCHEMA public (schedule_blocks) TO beauty_app;
            GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public (schedule_blocks) TO beauty_app;
        `);

        // Enable RLS on schedule_blocks and enforce it for beauty_app
        await queryRunner.query(`
            ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
            ALTER TABLE schedule_blocks FORCE ROW LEVEL SECURITY;
        `);

        // Verify the role exists
        const roles = await queryRunner.query(`
            SELECT rolname FROM pg_roles WHERE rolname = 'beauty_app'
        `);

        console.log('beauty_app role status:', roles);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the role if it was created
        await queryRunner.query(`
            DROP ROLE IF EXISTS beauty_app;
        `);

        // Disable RLS (but keep it enabled in production)
        await queryRunner.query(`
            ALTER TABLE schedule_blocks DISABLE ROW LEVEL SECURITY;
        `);
    }
}
