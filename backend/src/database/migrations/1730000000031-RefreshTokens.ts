import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refresh-token store (ADR-009).
 *
 * Access tokens are short-lived JWTs the client cannot revoke, so the API needs
 * a second, longer-lived credential the server *can* invalidate. Only the
 * SHA-256 hash is stored: a database leak must not hand an attacker usable
 * credentials, and the token itself is 32 random bytes, so a hash lookup is
 * exact and needs no salt.
 *
 * `family_id` is what makes reuse detection possible. Every rotation issues a
 * new token in the same family and revokes its predecessor, so each user has one
 * family per signed-in device. Presenting an already-revoked token means either
 * a replay or a stolen token being used after the real client rotated — both are
 * indistinguishable, so the whole family is revoked and the user must sign in
 * again. Revoking only the presented token would leave the attacker's copy
 * working.
 *
 * `replaced_by` records the chain so one session can be walked from its newest
 * token back to the login that created it.
 *
 * RLS note: this table is user-scoped, so the policy keys on
 * `app.current_user_id` rather than the tenant GUC. One honest caveat — the
 * rotation path must resolve `user_id` *from* the presented token hash, before
 * any user context exists. That lookup therefore only works for a role that
 * bypasses RLS (the app connects as the migration owner); a future move to a
 * NOBYPASSRLS role would break `/auth/refresh` rather than silently widen access.
 */
export class RefreshTokens1730000000031 implements MigrationInterface {
  name = 'RefreshTokens1730000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        family_id UUID NOT NULL,
        device_info VARCHAR(200),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        replaced_by UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id)`);
    // Only live tokens are ever looked up by user (logout-all, reuse checks),
    // so the partial index stays small as revocation accumulates.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id) WHERE revoked_at IS NULL`,
    );

    await queryRunner.query(`ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY refresh_tokens_user_isolation ON refresh_tokens
      USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
      WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
  }
}