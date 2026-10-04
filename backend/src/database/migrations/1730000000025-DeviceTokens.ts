import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FCM device tokens, so the reminder sweep can push as well as write in-app
 * rows and send SMS.
 *
 * User-scoped, not tenant-scoped: a customer belongs to no tenant and a
 * notification is read across every tenant the customer was booked into, so a
 * tenant column would hide tokens from exactly the requests that need them.
 * `users` itself stays FORCE ROW LEVEL SECURITY on `app.current_tenant_id` —
 * this table carries no RLS, the same trade-off `audit_logs` makes, because
 * token rows are keyed by a verified `user_id` from the JWT and never by a
 * request-supplied value.
 *
 * `token` is UNIQUE: an FCM token rotates when the app is reinstalled or the
 * OS refreshes it, so re-registering the same token from the same device must
 * upsert rather than insert a duplicate and double every push.
 */
export class DeviceTokens1730000000025 implements MigrationInterface {
  name = 'DeviceTokens1730000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(20) NOT NULL DEFAULT 'android',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS device_tokens`);
  }
}