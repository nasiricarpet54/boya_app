import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer addresses used at booking time.
 *
 * Isolation key is `user_id` + session GUC `app.current_user_id`, matching
 * `support_tickets` (Use Case — 1-2 — user-scoped). Addresses live in the
 * customer's own account; there is no tenant column: `setUserContext` scopes
 * every query, and `beauty_app` (the runtime role) is enforced via FORCE RLS
 * as a second net. `beauty` (the migration owner) bypasses RLS, so every
 * statement still filters `user_id` explicitly — two nets, never one.
 *
 * No FK to `bookings`: the address is denormalised onto the booking row
 * (`customer_address`, `customer_latitude`, `customer_longitude`) when the
 * booking is saved, so deleting an old address never breaks a confirmed
 * reservation. A partial unique index keeps at most one default:
 *   CREATE UNIQUE INDEX ... ON customer_addresses(user_id) WHERE is_default
 */
export class CreateCustomerAddresses implements MigrationInterface {
  name = 'CreateCustomerAddresses1792960000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE customer_addresses (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title           VARCHAR(20) NOT NULL DEFAULT 'home',
        address         TEXT NOT NULL,
        latitude        NUMERIC(10,7) NOT NULL,
        longitude       NUMERIC(10,7) NOT NULL,
        is_default      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT cta_title_check CHECK (title IN ('home','work','other'))
      )
    `);

    await qr.query(`
      CREATE INDEX idx_customer_addresses_user_id
      ON customer_addresses (user_id, created_at DESC)
    `);

    // Exactly one default per customer, enforced at the database level
    // (decision 5: switching default turns the previous one off).
    await qr.query(`
      CREATE UNIQUE INDEX idx_customer_addresses_user_default
      ON customer_addresses (user_id)
      WHERE is_default
    `);

    await qr.query(`
      ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY
    `);
    await qr.query(`
      ALTER TABLE customer_addresses FORCE ROW LEVEL SECURITY
    `);

    await qr.query(`
      CREATE POLICY customer_addresses_user_isolation
      ON customer_addresses
      USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
      WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    `);

    // `beauty` is the master user for migrations; `beauty_app` is the runtime
    // role created by docker/postgres/init/01-roles.sql (NOBYPASSRLS). Without
    // these grants a read/write against the RLS-scoped table by beauty_app
    // would be denied even though the policy already restricts rows to the
    // caller.
    await qr.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON customer_addresses TO beauty_app`);
    await qr.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beauty_app`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE customer_addresses CASCADE`);
  }
}
