import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Tickets Module
 * - tickets table with tracking_code, customer_id, tenant_id, specialist_id, booking_id, status, priority
 * - ticket_messages table with message and optional attachment
 * - enforcement through row-level security (RLS) policies for multi-tenant isolation
 */
export class CreateTicketsModule1730000000002 implements MigrationInterface {
  name = 'CreateTicketsModule1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tickets table
    await queryRunner.query(`
      CREATE TABLE tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tracking_code VARCHAR(20) UNIQUE NULL,
        customer_id UUID NOT NULL,
        tenant_id UUID,
        specialist_id UUID,
        booking_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open','investigating','resolved','closed')),
        priority VARCHAR(10) NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('low','medium','high')),
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create ticket_messages table
    await queryRunner.query(`
      CREATE TABLE ticket_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL,
        sender_id UUID NOT NULL,
        message TEXT NOT NULL,
        attachment_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX idx_tickets_customer_id ON tickets(customer_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_tickets_tenant_id ON tickets(tenant_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_tickets_specialist_id ON tickets(specialist_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_tickets_status ON tickets(status)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_tickets_tracking_code ON tickets(tracking_code)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_ticket_messages_sender_id ON ticket_messages(sender_id)`,
    );

    // Foreign keys
    await queryRunner.query(`
      ALTER TABLE tickets
      ADD CONSTRAINT tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id)
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE tickets
      ADD CONSTRAINT tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tickets
      ADD CONSTRAINT tickets_specialist_id_fkey FOREIGN KEY (specialist_id) REFERENCES specialists(id)
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tickets
      ADD CONSTRAINT tickets_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id)
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ticket_messages
      ADD CONSTRAINT ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE ticket_messages
      ADD CONSTRAINT ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id)
        ON DELETE CASCADE
    `);

    // Enable RLS on tickets and ticket_messages
    await queryRunner.query(`ALTER TABLE tickets ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY`);

    // Ticket tenant isolation policy
    await queryRunner.query(`
      CREATE POLICY tickets_tenant_isolation ON tickets
        USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    // For ticket_messages, also isolate by ticket's tenant
    await queryRunner.query(`
      CREATE POLICY ticket_messages_tenant_isolation ON ticket_messages
        USING (EXISTS (SELECT 1 FROM tickets WHERE id = ticket_id
                       AND (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)))
        WITH CHECK (EXISTS (SELECT 1 FROM tickets WHERE id = ticket_id
                           AND (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)))
    `);

    // Add update trigger to sync updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
       RETURNS TRIGGER AS \$\$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; \$\$ language 'plpgsql'
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_tickets_updated_at
        BEFORE UPDATE ON tickets
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tickets_tenant_isolation ON tickets`);
    await queryRunner.query(`DROP POLICY IF EXISTS ticket_messages_tenant_isolation ON ticket_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS ticket_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column`);
  }
}
