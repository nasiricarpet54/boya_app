import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableRLSWithBeautyAppRole1792850000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL has no `CREATE ROLE IF NOT EXISTS`: on any stack that ran
        // the docker init script (docker/postgres/init/01-roles.sql) or migration
        // 1729999999999, the role already exists and a bare CREATE ROLE fails with
        // SQLSTATE 42710, rolling the whole migration back on every re-deploy.
        // The DO block mirrors 1729999999999 so re-runs are a no-op.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'beauty_app') THEN
                    CREATE ROLE beauty_app NOLOGIN;
                END IF;
            END
            $$;
        `);

        // Ensure the app role has necessary permissions on all tables.
        // All of these are idempotent, so a re-run against an already-provisioned
        // database is safe too.
        await queryRunner.query(`
            GRANT CONNECT ON DATABASE "beauty_platform" TO beauty_app;
            GRANT USAGE ON SCHEMA public TO beauty_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beauty_app;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beauty_app;
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
