import { MigrationInterface, QueryRunner } from 'typeorm';

type DayWindow = { start: string; end: string };

const WEEK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Builds the `working_hours` JSONB payload parsed by `isSalonOpenNow`.
 *
 * Closed days are written as `{ active: false }` and open ones as
 * `{ start, end, active: true }`; a window whose end is not after its start runs
 * past midnight. Rows written before this shape changed still use
 * `open`/`close`/`closed`, which the reader keeps accepting.
 */
function weekHours(
  start: string,
  end: string,
  closedDays: readonly string[] = ['fri'],
  overrides: Partial<Record<(typeof WEEK_DAYS)[number], DayWindow>> = {},
): string {
  const schedule: Record<string, (DayWindow & { active: true }) | { active: false }> = {};
  for (const day of WEEK_DAYS) {
    schedule[day] = closedDays.includes(day)
      ? { active: false }
      : { ...(overrides[day] ?? { start, end }), active: true };
  }
  return JSON.stringify(schedule);
}

/** Serialises a `settings` object for a SQL single-quoted literal. */
function settingsJson(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/'/g, "''");
}

/**
 * Backs the public Salons API (GET /salons, /categories, /salons/:id).
 *
 * 1. service_categories  – global, tenant-agnostic lookup table for the Home
 *    screen filter chips.
 * 2. tenants             – listing columns the API contract needs:
 *      cover_image_url / rating / review_count   (the three planned fields)
 *      working_hours / settings                  (detail payload + isOpenNow)
 *      latitude / longitude                      (distanceKm)
 *      discount_percent                          (discountPercent)
 *      category_id                               (the ?category=<slug> filter)
 *    The last five are additive and nullable/defaulted: every existing tenant
 *    row keeps working, they simply surface as closed / no-distance in the API
 *    until a tenant fills them in.
 * 3. get_public_salon_tags() – SECURITY DEFINER, same trick as
 *    find_or_create_customer_by_phone() in 1730000000008. service_lines is
 *    FORCE ROW LEVEL SECURITY and the API connects as the non-BYPASSRLS role
 *    `beauty_app` without a tenant context, so a plain SELECT returns zero rows
 *    (verified against the dev DB). The function exposes nothing but the few
 *    public service-line names shown as tags.
 *
 * Everything is idempotent (IF NOT EXISTS / ON CONFLICT), so the migration can
 * be re-applied to a database that already has part of it.
 */
export class AddSalonFieldsAndCategories1730000000009
  implements MigrationInterface
{
  name = 'AddSalonFieldsAndCategories1730000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------- 1) lookup
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS service_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(60) NOT NULL UNIQUE,
        icon VARCHAR(60),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_service_categories_active_sort ON service_categories(is_active, sort_order)`,
    );
    // No RLS here: the category list is a global catalogue, like `referrals`
    // (see 1730000000006). New tables created by the owner already reach
    // beauty_app through ALTER DEFAULT PRIVILEGES (verified in pg_default_acl).

    // ------------------------------------------------------------------- 2) tenants
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5)`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS discount_percent SMALLINT CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100))`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tenants_category ON tenants(category_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tenants_active_rating ON tenants(rating DESC, review_count DESC) WHERE is_active`,
    );

    // The seeds below use `ON CONFLICT (slug) DO NOTHING`. tenants only had the
    // *partial* index idx_tenants_slug (WHERE slug IS NOT NULL), and Postgres
    // refuses a plain conflict target on a partial index — verified on the dev
    // DB: "there is no unique or exclusion constraint matching the ON CONFLICT
    // specification". A plain UNIQUE constraint keeps the same semantics (NULLs
    // stay distinct, so slug-less tenants are still allowed) and makes the
    // conflict target inferable everywhere.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'tenants'::regclass AND conname = 'uq_tenants_slug'
        ) THEN
          ALTER TABLE tenants ADD CONSTRAINT uq_tenants_slug UNIQUE (slug);
        END IF;
      END;
      $$;
    `);

    // ------------------------------------------------------- 3) public tag read
    // service_lines is FORCE ROW LEVEL SECURITY and the API role (beauty_app)
    // has no BYPASSRLS and no app.current_tenant_id when serving a *public*
    // listing that spans tenants, so a plain SELECT sees zero rows. Same
    // SECURITY DEFINER escape hatch as find_or_create_customer_by_phone().
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_public_salon_tags(
        p_tenant_ids UUID[],
        p_limit INTEGER DEFAULT 3
      )
      RETURNS TABLE (
        salon_id UUID,
        tag TEXT,
        ord INTEGER
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT ranked.tenant_id, ranked.name::TEXT, ranked.ord
        FROM (
          SELECT sl.tenant_id,
                 sl.name,
                 (ROW_NUMBER() OVER (
                   PARTITION BY sl.tenant_id ORDER BY sl.created_at, sl.name
                 ))::INTEGER AS ord
          FROM service_lines sl
          WHERE sl.tenant_id = ANY (p_tenant_ids)
            AND sl.is_active
        ) ranked
        WHERE ranked.ord <= COALESCE(p_limit, 3)
        ORDER BY ranked.tenant_id, ranked.ord
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION get_public_salon_tags(UUID[], INTEGER) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION get_public_salon_tags(UUID[], INTEGER) TO beauty_app;`,
    );

    // --------------------------------------------------- 4) seed data (dev only)
    // Mock content must never reach a real deployment. The category list is
    // static reference data, but it stays behind the same guard so this whole
    // block reads as "schema in production, fixtures only in development".
    if ((process.env.NODE_ENV ?? 'development') === 'production') {
      return;
    }

    await queryRunner.query(`
      INSERT INTO service_categories (name, slug, icon, sort_order)
      VALUES
        ('رنگ و هایلایت', 'hair-color', 'scissors', 1),
        ('کراتین و صافی مو', 'keratin', 'auto_fix_high', 2),
        ('کوتاهی و مدل مو', 'haircut', 'content_cut', 3),
        ('آرایش عروس', 'bridal-makeup', 'menu_book', 4),
        ('مژه و ابرو', 'lashes-brows', 'visibility', 5),
        ('میکروبلیدینگ', 'microblading', 'brush', 6),
        ('پوست و فیشیال', 'skincare', 'face', 7),
        ('ناخن‌کاری', 'nail-salon', 'gestures', 8),
        ('اپیلاسیون', 'waxing', 'layers', 9),
        ('تتو و تتوی دائمی', 'permanent-tattoo', 'draw', 10),
        ('ماساژ و اسپا', 'massage-spa', 'spa', 11),
        ('آرایش مردانه', 'mens-grooming', 'male', 12)
      ON CONFLICT (slug) DO NOTHING
    `);

    const salons = [
      {
        seed: 'salon-1',
        name: 'سالن زیبایی آروشا',
        slug: 'arousa-beauty',
        nameEn: 'Arousa Beauty Salon',
        address: 'تهران، خیابان ولیعصر، خیابان فرشته، پلاک ۱۲',
        phone: '021-88776655',
        rating: '4.8',
        reviewCount: 342,
        latitude: '35.7580000',
        longitude: '51.4100000',
        discountPercent: 20,
        categorySlug: 'hair-color',
        hours: weekHours('09:00', '20:00'),
        settings: { womenOnly: true, parking: true, onlinePayment: true, cancellationHours: 6 },
      },
      {
        seed: 'salon-2',
        name: 'استودیو زیبایی رز',
        slug: 'rose-beauty-studio',
        nameEn: 'Rose Beauty Studio',
        address: 'تهران، سعادت‌آباد، میدان کاج، بلوار دریا، پلاک ۴۵',
        phone: '021-22669988',
        rating: '4.7',
        reviewCount: 218,
        latitude: '35.7750000',
        longitude: '51.4010000',
        discountPercent: null,
        categorySlug: 'keratin',
        hours: weekHours('10:00', '21:00'),
        settings: { womenOnly: true, parking: false, onlinePayment: true, cancellationHours: 12 },
      },
      {
        seed: 'salon-3',
        name: 'سالن زیبایی نازلی',
        slug: 'nazli-beauty',
        nameEn: 'Nazli Beauty Salon',
        address: 'تهران، ونک، خیابان گاندی، خیابان دهم، پلاک ۸',
        phone: '021-88112244',
        rating: '4.9',
        reviewCount: 506,
        latitude: '35.7560000',
        longitude: '51.4230000',
        discountPercent: 15,
        categorySlug: 'bridal-makeup',
        hours: weekHours('09:00', '19:00'),
        settings: { womenOnly: true, parking: true, onlinePayment: false, cancellationHours: 24 },
      },
      {
        seed: 'salon-4',
        name: 'بیوتی سنتر المیرا',
        slug: 'elmira-beauty-center',
        nameEn: 'Elmira Beauty Center',
        address: 'تهران، جردن، خیابان ناهید، پلاک ۲۲',
        phone: '021-22334455',
        rating: '4.6',
        reviewCount: 127,
        latitude: '35.7640000',
        longitude: '51.4420000',
        discountPercent: null,
        categorySlug: 'lashes-brows',
        hours: weekHours('10:00', '20:00'),
        settings: { womenOnly: true, parking: false, onlinePayment: true, cancellationHours: 6 },
      },
      {
        seed: 'salon-5',
        name: 'پیناکل اسپا و بیوتی',
        slug: 'pinnacle-spa-beauty',
        nameEn: 'Pinnacle Spa & Beauty',
        address: 'تهران، پل رومی، خیابان رومی، پلاک ۳',
        phone: '021-22887766',
        rating: '4.5',
        reviewCount: 94,
        latitude: '35.7830000',
        longitude: '51.4350000',
        discountPercent: 10,
        categorySlug: 'massage-spa',
        // Spa opens every day, which keeps the Friday-closed default honest:
        // it is a default, and a salon that stores Friday hours overrides it.
        hours: weekHours('11:00', '22:00', []),
        settings: { womenOnly: true, parking: true, onlinePayment: true, cancellationHours: 8 },
      },
    ];

    const salonValues = salons
      .map(
        (salon) =>
          `('${salon.name}', '${salon.slug}', '${salon.nameEn}', '${salon.address}', ` +
          `'${salon.phone}', true, 'https://picsum.photos/seed/${salon.seed}/400/300', ` +
          `${salon.rating}, ${salon.reviewCount}, '${salon.hours}'::jsonb, ` +
          `'${settingsJson(salon.settings)}'::jsonb, ${salon.latitude}, ${salon.longitude}, ` +
          `${salon.discountPercent ?? 'NULL'}, ` +
          `(SELECT id FROM service_categories WHERE slug = '${salon.categorySlug}'))`,
      )
      .join(',\n        ');

    await queryRunner.query(`
      INSERT INTO tenants (
        name, slug, name_en, address, phone, is_active, cover_image_url,
        rating, review_count, working_hours, settings,
        latitude, longitude, discount_percent, category_id
      )
      VALUES
        ${salonValues}
      ON CONFLICT (slug) DO NOTHING
    `);

    // Service lines are what the cards render as tags, services drive minPrice.
    const lineValues = [
      ['arousa-beauty', 'رنگ و هایلایت'],
      ['arousa-beauty', 'کراتین و صافی'],
      ['arousa-beauty', 'کوتاهی مو'],
      ['rose-beauty-studio', 'کراتین و صافی'],
      ['rose-beauty-studio', 'مراقبت مو'],
      ['nazli-beauty', 'آرایش عروس'],
      ['nazli-beauty', 'شینیون'],
      ['nazli-beauty', 'میکاپ'],
      ['elmira-beauty-center', 'کاشت مژه'],
      ['elmira-beauty-center', 'لمینت ابرو'],
      ['elmira-beauty-center', 'میکروبلیدینگ'],
      ['pinnacle-spa-beauty', 'ماساژ'],
      ['pinnacle-spa-beauty', 'فیشیال'],
      ['pinnacle-spa-beauty', 'اسپا'],
    ]
      .map(([slug, name]) => `('${slug}', '${name}')`)
      .join(', ');

    await queryRunner.query(`
      INSERT INTO service_lines (tenant_id, name)
      SELECT t.id, v.line_name
      FROM (VALUES ${lineValues}) AS v(salon_slug, line_name)
      JOIN tenants t ON t.slug = v.salon_slug
      ON CONFLICT (tenant_id, name) DO NOTHING
    `);

    const serviceValues = [
      ['arousa-beauty', 'رنگ و هایلایت', 'رنگ مو خارجی', 680000],
      ['arousa-beauty', 'کراتین و صافی', 'کراتین مو', 1200000],
      ['arousa-beauty', 'کوتاهی مو', 'کوتاهی و سشوار', 250000],
      ['rose-beauty-studio', 'کراتین و صافی', 'کراتین برزیلی', 1450000],
      ['rose-beauty-studio', 'مراقبت مو', 'بادی‌اسپلند مو', 550000],
      ['nazli-beauty', 'آرایش عروس', 'پکیج آرایش عروس', 3500000],
      ['nazli-beauty', 'شینیون', 'شینیون مجلسی', 450000],
      ['nazli-beauty', 'میکاپ', 'میکاپ مجلسی', 900000],
      ['elmira-beauty-center', 'کاشت مژه', 'کاشت مژه کلاسیک', 850000],
      ['elmira-beauty-center', 'لمینت ابرو', 'لمینت ابرو', 700000],
      ['elmira-beauty-center', 'میکروبلیدینگ', 'میکروبلیدینگ ابرو', 1800000],
      ['pinnacle-spa-beauty', 'ماساژ', 'ماساژ سوئدی ۶۰ دقیقه', 420000],
      ['pinnacle-spa-beauty', 'فیشیال', 'فیشیال پوست', 600000],
      ['pinnacle-spa-beauty', 'اسپا', 'پکیج اسپا', 980000],
    ]
      .map(([slug, line, name, price]) => `('${slug}', '${line}', '${name}', ${price})`)
      .join(', ');

    // services has no natural unique key, so guard with NOT EXISTS instead of
    // ON CONFLICT. line_id resolves through the line inserted just above.
    await queryRunner.query(`
      INSERT INTO services (tenant_id, line_id, name, price)
      SELECT t.id, l.id, v.service_name, v.price
      FROM (VALUES ${serviceValues}) AS v(salon_slug, line_name, service_name, price)
      JOIN tenants t ON t.slug = v.salon_slug
      LEFT JOIN service_lines l ON l.tenant_id = t.id AND l.name = v.line_name
      WHERE NOT EXISTS (
        SELECT 1 FROM services s WHERE s.tenant_id = t.id AND s.name = v.service_name
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS get_public_salon_tags(UUID[], INTEGER)`,
    );
    // Only the fixture rows this migration owns: both slug and name must match,
    // so a real salon that happens to share a slug is never deleted.
    await queryRunner.query(`
      DELETE FROM tenants
      WHERE slug IN ('arousa-beauty', 'rose-beauty-studio', 'nazli-beauty', 'elmira-beauty-center', 'pinnacle-spa-beauty')
        AND name IN ('سالن زیبایی آروشا', 'استودیو زیبایی رز', 'سالن زیبایی نازلی', 'بیوتی سنتر المیرا', 'پیناکل اسپا و بیوتی')
    `);
    await queryRunner.query(`
      DELETE FROM service_categories
      WHERE slug IN ('hair-color', 'keratin', 'haircut', 'bridal-makeup', 'lashes-brows', 'microblading', 'skincare', 'nail-salon', 'waxing', 'permanent-tattoo', 'massage-spa', 'mens-grooming')
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_active_rating`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_category`);
    await queryRunner.query(`ALTER TABLE tenants DROP CONSTRAINT IF EXISTS uq_tenants_slug`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS category_id`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS discount_percent`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS longitude`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS latitude`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS settings`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS working_hours`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS review_count`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS rating`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS cover_image_url`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_service_categories_active_sort`);
    await queryRunner.query(`DROP TABLE IF EXISTS service_categories`);
  }
}

