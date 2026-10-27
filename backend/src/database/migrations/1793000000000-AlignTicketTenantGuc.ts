import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ticket policies predate the unified tenant GUC and still read app.tenant_id,
 * while the API sets app.current_tenant_id. Recreate them using the runtime GUC
 * without changing their existing allowance for tickets with a NULL tenant_id.
 */
export class AlignTicketTenantGuc1793000000000 implements MigrationInterface {
  name = 'AlignTicketTenantGuc1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS tickets_tenant_isolation ON tickets;
      CREATE POLICY tickets_tenant_isolation ON tickets
        USING (
          tenant_id IS NULL OR
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          tenant_id IS NULL OR
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );

      DROP POLICY IF EXISTS ticket_messages_tenant_isolation ON ticket_messages;
      CREATE POLICY ticket_messages_tenant_isolation ON ticket_messages
        USING (
          EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_messages.ticket_id
              AND (
                tickets.tenant_id IS NULL OR
                tickets.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              )
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_messages.ticket_id
              AND (
                tickets.tenant_id IS NULL OR
                tickets.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              )
          )
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS tickets_tenant_isolation ON tickets;
      CREATE POLICY tickets_tenant_isolation ON tickets
        USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

      DROP POLICY IF EXISTS ticket_messages_tenant_isolation ON ticket_messages;
      CREATE POLICY ticket_messages_tenant_isolation ON ticket_messages
        USING (
          EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_messages.ticket_id
              AND (
                tickets.tenant_id IS NULL OR
                tickets.tenant_id = current_setting('app.tenant_id', true)::uuid
              )
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_messages.ticket_id
              AND (
                tickets.tenant_id IS NULL OR
                tickets.tenant_id = current_setting('app.tenant_id', true)::uuid
              )
          )
        );
    `);
  }
}
