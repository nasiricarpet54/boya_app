import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BUG-1 — the customer's reminder SMS never goes out.
 *
 * `ReminderScheduler.notify()` looks the customer's phone up to send the booking
 * alert. The cron runs with no tenant context, and `users` is
 * `ENABLE + FORCE ROW LEVEL SECURITY`, so a plain `SELECT phone FROM users` is
 * filtered to zero rows. The previous query made it worse: it also INNER JOINed
 * `tenants ON t.id = u.tenant_id`, and a customer's `tenant_id` is NULL by
 * design (migration 1730000000007), so the row was dropped before the RLS filter
 * even ran — every customer SMS was silently skipped.
 *
 * A narrow SECURITY DEFINER lookup, the same escape hatch the rest of the
 * customer-facing reads use. It returns one phone for one user id, is executable
 * by the backend role alone (not PUBLIC), and touches no policy.
 */
export class UserPhoneLookup1730000000029 implements MigrationInterface {
  name = 'UserPhoneLookup1730000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_user_phone(
        p_user_id UUID
      )
      RETURNS TEXT
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT u.phone::TEXT FROM users u WHERE u.id = p_user_id
      $$;
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION get_user_phone(UUID) FROM PUBLIC;`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION get_user_phone(UUID) TO beauty_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_user_phone(UUID)`);
  }
}