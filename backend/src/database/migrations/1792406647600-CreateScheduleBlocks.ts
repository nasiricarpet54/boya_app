import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScheduleBlocks1792406647600 implements MigrationInterface {
  name = 'CreateScheduleBlocks1792406647600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "schedule_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "specialist_id" uuid,
        "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "reason" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedule_blocks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_schedule_blocks_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_schedule_blocks_specialist_id" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`ALTER TABLE "schedule_blocks" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "schedule_blocks" FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON "schedule_blocks"
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY "tenant_isolation_policy" ON "schedule_blocks"`);
    await queryRunner.query(`ALTER TABLE "schedule_blocks" DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP TABLE "schedule_blocks"`);
  }
}
