import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSForTransactions1792048339003 implements MigrationInterface {
  name = 'RLSForTransactions' + String(Date.now()); // Fallback name

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE transactions ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE transactions FORCE ROW LEVEL SECURITY`);

    const res = await queryRunner.query(`
      SELECT policyname
      FROM pg_policies
      WHERE tablename = 'transactions' AND policyname = 'transactions_tenant_isolation'
    `);

    if (res.length === 0) {
      await queryRunner.query(`
        CREATE POLICY transactions_tenant_isolation ON transactions
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS transactions_tenant_isolation ON transactions`);
    await queryRunner.query(`ALTER TABLE transactions NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE transactions DISABLE ROW LEVEL SECURITY`);
  }
}
