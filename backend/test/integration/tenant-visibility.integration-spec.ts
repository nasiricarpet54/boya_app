import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';

import { SalonQueryDto } from '../../src/modules/salon/dto/salon-query.dto';
import { SalonService } from '../../src/modules/salon/salon.service';
import { describeIntegration, getAdminDataSource, queryAsAdmin } from '../setup/integration.setup';

/**
 * Public catalogue visibility (ADR-010 follow-up): which salons the customer
 * app may see.
 *
 * `SalonService.list()` is the one screen-level function that decides this, and
 * it composes two independent rules — neither of which is obvious from the
 * column names:
 *
 *   - `t.is_active = true` — the operator kill-switch.
 *   - `PUBLIC_SALON_SQL` = `t.approved_at IS NOT NULL AND t.status <> 'suspended'`
 *     — the moderation lifecycle. `approved_at` is what makes a `draft` salon
 *     invisible; a single `status` check would either hide a live salon edited
 *     back to `draft`, or publish one that was only ever rejected.
 *
 * The four cases below pin the *combination* down, because each predicate alone
 * lets one of the bad states leak. The spec calls the real `list()` rather than
 * re-deriving the SQL, so the assertion cannot drift from the service.
 *
 * Runs on the migration-owner connection (`getAdminDataSource()`), the role the
 * application itself connects as. `list()` resolves visibility from the
 * `tenants` row, which carries no RLS policy, so this access path matches
 * production. Slugs are namespaced and wiped first so a re-run starts clean.
 */
describeIntegration('public salon visibility (is_active x status/approved_at)', () => {
  let dataSource: DataSource;
  let salonService: SalonService;

  let slugCounter = 0;
  const nextSlug = () => `it-visibility-${Date.now()}-${++slugCounter}`;

  /** Seeds a salon with just the columns the visibility rules read. */
  async function seedSalon(
    slug: string,
    status: string,
    approvedAt: string | null,
    isActive: boolean,
  ): Promise<string> {
    const rows = await queryAsAdmin<{ id: string }>(
      `INSERT INTO tenants (name, slug, status, approved_at, is_active)
       VALUES ($1, $2, $3::approval_status, $4, $5)
       RETURNING id`,
      [`Visibility ${slug}`, slug, status, approvedAt, isActive],
    );
    return rows[0].id;
  }

  /** The `id` of every salon `list()` returns, across all pages. */
  async function listedIds(): Promise<string[]> {
    const page = await salonService.list({ page: 1, limit: 100 } as SalonQueryDto);
    return page.data.map((salon) => salon.id);
  }

  beforeAll(async () => {
    dataSource = getAdminDataSource();
    salonService = new SalonService(dataSource, new EventEmitter2(), { invalidateTenantCache: async () => undefined } as never);

    // `users`/`bookings` reference `tenants` without a cascade, but this spec
    // seeds neither, so the tenant rows drop cleanly on their own.
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-visibility-%'`);
  });

  afterAll(async () => {
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-visibility-%'`);
  });

  it('hides a draft salon that has never been approved', async () => {
    const id = await seedSalon(nextSlug(), 'draft', null, true);
    expect(await listedIds()).not.toContain(id);
  });

  it('shows an approved, active salon', async () => {
    const id = await seedSalon(nextSlug(), 'approved', new Date().toISOString(), true);
    expect(await listedIds()).toContain(id);
  });

  it('hides an approved salon the operator deactivated', async () => {
    // Approval is intact (`approved_at` set, status `approved`) — only the
    // kill-switch is off, so this isolates `is_active` from the lifecycle.
    const id = await seedSalon(nextSlug(), 'approved', new Date().toISOString(), false);
    expect(await listedIds()).not.toContain(id);
  });

  it('hides a suspended salon even though it was approved before', async () => {
    // A previously-live salon that moderation suspended: `approved_at` is set,
    // so `is_active` alone would publish it — the `status <> 'suspended'` half
    // of PUBLIC_SALON_SQL is what removes it.
    const id = await seedSalon(nextSlug(), 'suspended', new Date().toISOString(), true);
    expect(await listedIds()).not.toContain(id);
  });

  it('hides a salon that is both inactive and never approved', async () => {
    const id = await seedSalon(nextSlug(), 'draft', null, false);
    expect(await listedIds()).not.toContain(id);
  });
});
