import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Docker init script is intentionally only a convenience for local
 * databases. CI service containers do not support bind-mounted init scripts,
 * so the migration chain must create the RLS subject role itself.
 */
export class EnsureApplicationRole1729999999999 implements MigrationInterface {
  name = 'EnsureApplicationRole1729999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'beauty_app') THEN
          CREATE ROLE beauty_app WITH LOGIN PASSWORD 'app_password_dev';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`ALTER ROLE beauty_app NOBYPASSRLS NOSUPERUSER;`);
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO beauty_app;`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beauty_app;`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beauty_app;`,
    );
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO beauty_app;
    `);
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO beauty_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE ALL ON SCHEMA public FROM beauty_app;`);
    await queryRunner.query(`DROP ROLE IF EXISTS beauty_app;`);
  }
}
