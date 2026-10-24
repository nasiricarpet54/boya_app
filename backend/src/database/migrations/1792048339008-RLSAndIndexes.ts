import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSAndIndexes1792048339008 implements MigrationInterface {
  name = 'RLSAndIndexes1792048339008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = ['tenants', 'specialists', 'services', 'bookings', 'transactions'];

    // 1. Enable RLS and Force RLS for all specified tables
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      // 2. Create Policies for Tenant Isolation (Using app.current_tenant_id)
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table}`);

      // For 'tenants' table, the column is 'id'. For others, it's 'tenant_id'
      const column = table === 'tenants' ? 'id' : 'tenant_id';

      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_isolation ON ${table}
        USING (${column} = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
        WITH CHECK (${column} = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
      `);
    }

    // 3. Ensure B-Tree Indexes with tenant_id as the leading column are created
    // We already have idx_bookings_tenant_time and idx_transactions_tenant_status from previous migrations.
    // Creating missing indexes to avoid Sequential Scans for specialists and services tables.
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_specialists_tenant_id ON specialists(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = ['tenants', 'specialists', 'services', 'bookings', 'transactions'];

    for (const table of tables) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }

    await queryRunner.query(`DROP INDEX IF EXISTS idx_specialists_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_services_tenant_id`);
  }
}
