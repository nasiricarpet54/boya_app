import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Invite tokens (ADR-010).
 *
 * A salon needs a way to bring staff on board without an admin doing it by
 * hand, and without anyone being able to sign themselves up as a `salon_owner`:
 * the customer login path deliberately creates `role = 'customer'`, so an
 * invited phone arriving through it would otherwise be stuck as a customer.
 *
 * Only the SHA-256 hash is stored, the same reasoning as refresh_tokens — a
 * dump of this table must yield nothing that can be presented. The plaintext is
 * returned exactly once, to the inviter, for the SMS link.
 *
 * `invite_role` is a closed enum rather than a free string: an invite *grants*
 * staff access, so an unrecognised value must fail at the database rather than
 * becoming a role the application has to guess about. `customer` and `admin`
 * are deliberately absent — nobody is invited to be a customer, and admin
 * accounts are created out of band.
 *
 * Tenant-scoped (unlike `refresh_tokens`, which is user-scoped): an invite only
 * ever means something inside one salon, so `app.current_tenant_id` is the right
 * key and the cross-tenant read is refused by RLS rather than by a filter.
 */
export class InviteTokens1730000000032 implements MigrationInterface {
  name = 'InviteTokens1730000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invite_role AS ENUM ('salon_owner', 'line_manager', 'specialist');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        role invite_role NOT NULL,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        -- Optional: the inviter may already know the number, or may only have an
        -- address. Either way redemption still requires a verified OTP.
        phone VARCHAR(20),
        email VARCHAR(200),
        invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        used_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // The panel only ever lists "still open" invites, and those are a small
    // slice of the table, so both indexes are partial.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_invite_tokens_tenant ON invite_tokens(tenant_id) WHERE used_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_invite_tokens_pending ON invite_tokens(expires_at) WHERE used_at IS NULL`,
    );

    await queryRunner.query(`ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE invite_tokens FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY invite_tokens_tenant_isolation ON invite_tokens
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS invite_tokens`);
    await queryRunner.query(`DROP TYPE IF EXISTS invite_role`);
  }
}