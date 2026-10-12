import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Iranian provinces and cities, plus their optional links into tenants/users.
 *
 * provinces/cities are global, tenant-agnostic reference tables — the same
 * category as service_categories (1730000000009) — so they carry no RLS: every
 * session reads the full list, and nothing in them is tenant-scoped. Rows come
 * from the seed migration 1730000000039.
 *
 * The links are deliberately nullable with no ON DELETE action:
 *  - tenants.province_id / tenants.city_id — where the salon is. Optional
 *    because a salon can be created before its city is picked, and dropping a
 *    city must never cascade into destroying or silently orphaning a salon.
 *  - users.city_id — the customer's default city, used to pre-fill the booking
 *    address. Same reasoning: a user row outlives any city row.
 *
 * No `transaction = false` here: nothing in this chain is an ALTER TYPE, so the
 * whole migration runs inside one transactional block.
 */
export class ProvincesCities1730000000038 implements MigrationInterface {
  name = 'ProvincesCities1730000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // جدول استان‌ها
    await queryRunner.query(`
      CREATE TABLE provinces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(5) NOT NULL UNIQUE,        -- مثل 'THR'
        name_fa VARCHAR(100) NOT NULL,          -- 'تهران'
        name_en VARCHAR(100) NOT NULL,          -- 'Tehran'
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        display_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // جدول شهرها
    await queryRunner.query(`
      CREATE TABLE cities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        province_id UUID NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
        code VARCHAR(10) NOT NULL,
        name_fa VARCHAR(100) NOT NULL,          -- 'تهران'
        name_en VARCHAR(100) NOT NULL,          -- 'Tehran'
        is_capital BOOLEAN NOT NULL DEFAULT FALSE,
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        display_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (province_id, code)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_cities_province ON cities(province_id, display_order)`);
    await queryRunner.query(`CREATE INDEX idx_cities_name_fa ON cities(name_fa)`);

    // اتصال به tenants
    await queryRunner.query(`ALTER TABLE tenants ADD COLUMN province_id UUID REFERENCES provinces(id)`);
    await queryRunner.query(`ALTER TABLE tenants ADD COLUMN city_id UUID REFERENCES cities(id)`);
    await queryRunner.query(`CREATE INDEX idx_tenants_city ON tenants(city_id) WHERE city_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_tenants_province ON tenants(province_id) WHERE province_id IS NOT NULL`);

    // اتصال به users (شهر پیش‌فرض مشتری)
    await queryRunner.query(`ALTER TABLE users ADD COLUMN city_id UUID REFERENCES cities(id)`);
    await queryRunner.query(`CREATE INDEX idx_users_city ON users(city_id) WHERE city_id IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_city`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS city_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_province`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_city`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS province_id`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS city_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS cities`);
    await queryRunner.query(`DROP TABLE IF EXISTS provinces`);
  }
}
