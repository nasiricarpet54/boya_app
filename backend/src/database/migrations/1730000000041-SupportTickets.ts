import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Support tickets (ADR-013): the customer app's «پشتیبانی» page.
 *
 * The table is user-scoped, not tenant-scoped. A complaint about a booking is
 * filed by the *customer* who made it against a salon, so the ownership key is
 * `user_id`; `salon_id`/`booking_id` are optional context the admin panel reads
 * to understand what the ticket is about, and both go `NULL` if the salon or the
 * booking row is deleted rather than cascading the delete onto the ticket — a
 * complaint must survive the thing it complained about.
 *
 * `admin_response` plus `responded_by`/`responded_at` keep the reply on the
 * ticket row. A separate reply table is not needed for the phase-1 flow (one
 * answer closes or reopens a ticket), and `status` + `responded_at` are enough
 * for the panel's open/answered/closed lists without a join.
 *
 * RLS is the same pattern as `refresh_tokens`: keyed on
 * `app.current_user_id`, and `FORCE`d so the owner cannot accidentally see
 * another user's tickets through a role that lacks `BYPASSRLS`. The app connects
 * as the migration owner, which bypasses RLS, so the service still filters by
 * `user_id` explicitly — the guard is a second net, not the only one.
 */
export class SupportTickets1730000000041 implements MigrationInterface {
  name = 'SupportTickets1730000000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL DEFAULT 'question',
        subject VARCHAR(200) NOT NULL,
        message VARCHAR(5000) NOT NULL,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        salon_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        priority VARCHAR(10) NOT NULL DEFAULT 'medium',
        admin_response TEXT,
        responded_by UUID REFERENCES users(id),
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT support_tickets_type_check
          CHECK (type IN ('question', 'complaint', 'suggestion', 'other')),
        CONSTRAINT support_tickets_status_check
          CHECK (status IN ('open', 'answered', 'closed')),
        CONSTRAINT support_tickets_priority_check
          CHECK (priority IN ('low', 'medium', 'high'))
      )
    `);
    // The customer's own list is the only read path in phase 1, and it always
    // filters by `user_id` newest-first, so this index covers it. `status` is
    // what the admin panel will group on later.
    await queryRunner.query(
      `CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_support_tickets_status ON support_tickets(status)`,
    );

    await queryRunner.query(`ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY support_tickets_user_isolation ON support_tickets
      USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
      WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS support_tickets`);
  }
}
