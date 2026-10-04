import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The cron sweeps silently did nothing for the same reason BUG-1's SMS lookup
 * did: `bookings` and `users` are FORCE ROW LEVEL SECURITY, and the `@Cron`
 * handlers run with **no** `app.current_tenant_id` set. A bare
 * `UPDATE bookings ... WHERE status = ...` is filtered to zero rows, so
 * `claimDue` claimed nothing and `markNoShows` flipped nothing — reminders
 * never fired and overdue bookings were never marked no-show. The follow-up
 * `UPDATE users SET no_show_count = ...` was likewise RLS-filtered to no-op.
 *
 * Fix follows the same escape hatch the rest of the scheduler uses
 * (`get_user_phone`, 1730000000029): SECURITY DEFINER functions owned by the
 * migration role. They return only the claimed rows and are executable by the
 * backend role alone, never by PUBLIC. No RLS policy is broadened.
 *
 * `VOLATILE` (not STABLE): each function writes, so it is never inlined away.
 */
export class ReminderSweepsAsSecurityDefiner1730000000030 implements MigrationInterface {
  name = 'ReminderSweepsAsSecurityDefiner1730000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION claim_due_booking_reminders(p_lead_hours INT)
      RETURNS TABLE (id UUID, tenant_id UUID, customer_id UUID)
      LANGUAGE sql
      VOLATILE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        UPDATE bookings b
        SET booking_reminder_sent_at = NOW()
        WHERE b.status = 'confirmed'
          AND b.booking_reminder_sent_at IS NULL
          AND lower(b.time_slot) > NOW()
          AND lower(b.time_slot) <= NOW() + (COALESCE(p_lead_hours, 24) || ' hours')::interval
        RETURNING b.id, b.tenant_id, b.customer_id;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION claim_due_feedback_reminders(p_delay_hours INT, p_window_hours INT)
      RETURNS TABLE (id UUID, tenant_id UUID, customer_id UUID)
      LANGUAGE sql
      VOLATILE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        UPDATE bookings b
        SET feedback_reminder_sent_at = NOW()
        WHERE b.status = 'completed'
          AND b.feedback_reminder_sent_at IS NULL
          AND upper(b.time_slot) <= NOW() - (COALESCE(p_delay_hours, 2) || ' hours')::interval
          AND upper(b.time_slot) > NOW() - (COALESCE(p_window_hours, 24) || ' hours')::interval
        RETURNING b.id, b.tenant_id, b.customer_id;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION mark_no_show_bookings(p_grace_minutes INT)
      RETURNS TABLE (id UUID, customer_id UUID)
      LANGUAGE plpgsql
      VOLATILE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        RETURN QUERY
        WITH swept AS (
          UPDATE bookings b
          SET status = 'no_show'
          WHERE b.status = 'confirmed'
            AND b.visit_confirmed_by_customer_at IS NULL
            AND lower(b.time_slot) + (COALESCE(p_grace_minutes, 30) || ' minutes')::interval < NOW()
          RETURNING b.id, b.customer_id
        ),
        bumped AS (
          UPDATE users u
          SET no_show_count = u.no_show_count + 1
          FROM swept s
          WHERE u.id = s.customer_id
          RETURNING s.id AS booking_id, s.customer_id
        )
        -- bumped is joined in (not left unreferenced) so the users UPDATE is
        -- guaranteed to have run before the function returns its rows.
        SELECT swept.id, swept.customer_id
        FROM swept
        LEFT JOIN bumped ON bumped.booking_id = swept.id;
      END;
      $$;
    `);

    await queryRunner.query(`REVOKE ALL ON FUNCTION claim_due_booking_reminders(INT) FROM PUBLIC;`);
    await queryRunner.query(`REVOKE ALL ON FUNCTION claim_due_feedback_reminders(INT, INT) FROM PUBLIC;`);
    await queryRunner.query(`REVOKE ALL ON FUNCTION mark_no_show_bookings(INT) FROM PUBLIC;`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION claim_due_booking_reminders(INT) TO beauty_app;`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION claim_due_feedback_reminders(INT, INT) TO beauty_app;`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION mark_no_show_bookings(INT) TO beauty_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS mark_no_show_bookings(INT)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS claim_due_feedback_reminders(INT, INT)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS claim_due_booking_reminders(INT)`);
  }
}
