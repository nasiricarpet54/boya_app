import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserTenantNullable1730000000007
  implements MigrationInterface
{
  name = 'MakeUserTenantNullable1730000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Not reversible without data loss; leave as-is
  }
}
