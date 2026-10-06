import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { SmsService } from '@mirad-work/sms-nestjs';
import { DataSource } from 'typeorm';

import { InviteTokenService } from '../../src/modules/auth/invite-token.service';
import type { AuthenticatedUser } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RefreshTokenService } from '../../src/modules/auth/refresh-token.service';
import { UpdateSpecialistPanelDto } from '../../src/modules/salon/dto/specialist-panel.dto';
import { SalonService } from '../../src/modules/salon/salon.service';
import { Tenant } from '../../src/modules/tenant/entities/tenant.entity';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { adminConfig, TEST_DB_NAME } from '../setup/test-db';
import { describeIntegration, queryAsAdmin } from '../setup/integration.setup';

/**
 * PATCH /salon/me/specialists/:id — the ownership (IDOR) boundary.
 *
 * `requireStaffTenant` only checks that the caller is staff *of some* salon.
 * The specialist row lookup then scoped by `tenant_id` alone, so a specialist
 * — who is staff, and therefore past that guard — could rewrite any other
 * specialist of the same salon by id. The ids are uuids, but the panel lists
 * every specialist of the signed-in salon, so they are not secret and this is
 * a real cross-account write, not a theoretical one.
 *
 * The rule the service must enforce:
 *  - `specialist` -> only the row carrying their own `user_id`;
 *  - `salon_owner` / `line_manager` -> any specialist of their salon (that is
 *    what managing a salon means);
 *  - anyone else -> `requireStaffTenant` has already refused them.
 *
 * Everything runs through the real `SalonService.updatePanelSpecialist`, the
 * same call the controller makes, so the assertion cannot drift from the code.
 * `NotFoundException` is what the service throws; Nest maps it to 404, which is
 * the response the app sees.
 *
 * Phone/slug namespaces are disjoint from the sibling specs because jest runs
 * the integration suites in parallel workers sharing one test database: this
 * one owns `0912990…` / `it-idor-…`.
 */
describeIntegration('specialist IDOR (PATCH /salon/me/specialists/:id)', () => {
  let dataSource: DataSource;
  let tenantService: TenantService;
  let salonService: SalonService;
  let inviteService: InviteTokenService;

  let slugCounter = 0;
  const nextSlug = () => `it-idor-${Date.now()}-${++slugCounter}`;

  /** Owns `0912990…`; the sibling specs own `0912887…`/`0912888…`/`0912889…`/`0912999…`. */
  let phoneCounter = 0;
  const nextPhone = () => `0912990${(++phoneCounter).toString().padStart(4, '0')}`;

  const configStub = {
    get: <T>(_key: string, fallback: T) => fallback,
  } as unknown as ConfigService;


  beforeAll(async () => {
    // Own connection with the `Tenant` entity attached, so `TenantService` can
    // be built — the shared DataSource declares `entities: []`.
    dataSource = new DataSource({
      type: 'postgres',
      host: String(adminConfig.host),
      port: Number(adminConfig.port),
      username: String(adminConfig.user),
      password: String(adminConfig.password),
      database: TEST_DB_NAME,
      entities: [Tenant],
      synchronize: false,
    });
    await dataSource.initialize();

    tenantService = new TenantService(dataSource.getRepository(Tenant));
    salonService = new SalonService(dataSource, new EventEmitter2());

    const refreshTokenService = new RefreshTokenService(
      dataSource,
      new JwtService({ secret: 'integration-secret' }),
      configStub,
    );
    inviteService = new InviteTokenService(
      dataSource,
      refreshTokenService,
      configStub,
      // KAVENEGAR_INVITE_TEMPLATE is unset on the stub, so `create` logs and
      // skips the SMS — no spec ever reaches a provider.
      { verify: async () => ({ success: false }) } as unknown as SmsService,
    );

    await clearFixtures();
  }, 30_000);

  afterAll(async () => {
    await clearFixtures();
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  /**
   * `specialists` first (it references both other tables), then users, then
   * tenants — the column foreign keys carry no cascade, so that is the only
   * order that deletes cleanly. `invite_tokens` cascades from both `tenants`
   * and its `invited_by` user, so it needs no step of its own.
   */
  async function clearFixtures(): Promise<void> {
    await queryAsAdmin(
      `DELETE FROM specialists WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-idor-%')`,
    );
    await queryAsAdmin(
      `DELETE FROM specialists WHERE user_id IN (SELECT id FROM users WHERE phone LIKE '0912990%')`,
    );
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912990%'`);
    await queryAsAdmin(
      `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-idor-%')`,
    );
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-idor-%'`);
  }

  /** A `salon_owner` row inside [tenantId]; a live owner is always a real row. */
  async function seedOwner(tenantId: string, phone: string): Promise<string> {
    const rows = await queryAsAdmin<{ id: string }>(
      `INSERT INTO users (tenant_id, phone, role, full_name)
       VALUES ($1, $2, 'salon_owner', $3) RETURNING id`,
      [tenantId, phone, 'مالک تست'],
    );
    return rows[0].id;
  }

  /**
   * A specialist brought in the way the panel brings them in — invite then
   * accept — so the auto-created `specialists` row (ADR-010) is a real row with
   * a real `user_id`, exactly the shape the route is asked to write.
   */
  async function seedSpecialist(
    tenantId: string,
    ownerId: string,
    phone: string,
  ): Promise<{ user: AuthenticatedUser; rowId: string }> {
    const invite = await inviteService.create({ role: 'specialist', phone }, ownerId, tenantId);
    const accepted = await inviteService.accept(invite.token, phone);
    const rows = await queryAsAdmin<{ id: string }>(
      `SELECT id FROM specialists WHERE user_id = $1`,
      [accepted.user.id],
    );
    return {
      user: asUser(accepted.user.id, 'specialist', tenantId, phone),
      rowId: rows[0].id,
    };
  }

  /** The identity `JwtAuthGuard` would attach from a real access token. */
  const asUser = (
    id: string,
    role: AuthenticatedUser['role'],
    tenantId: string | null,
    phone: string,
  ): AuthenticatedUser => ({ userId: id, role, tenantId, phoneNumber: phone });

  it('refuses a specialist patching a colleague of the same salon', async () => {
    const salon = await tenantService.create({ name: 'IDOR Salon', slug: nextSlug() });
    const ownerId = await seedOwner(salon.id, nextPhone());
    const attacker = await seedSpecialist(salon.id, ownerId, nextPhone());
    const victim = await seedSpecialist(salon.id, ownerId, nextPhone());

    // The attacker is staff of this salon, so the tenant guard lets them
    // through; only the ownership term can stop the write. Before that term
    // existed this returned `{ status: 'approved' }` and the row was rewritten.
    await expect(
      salonService.updatePanelSpecialist(attacker.user, victim.rowId, {
        bio: 'hacked',
      } as UpdateSpecialistPanelDto),
    ).rejects.toThrow(NotFoundException);

    // …and nothing was written: the victim's bio stays whatever it was.
    const victimRow = await queryAsAdmin<{ bio: string | null }>(
      `SELECT bio FROM specialists WHERE id = $1`,
      [victim.rowId],
    );
    expect(victimRow[0].bio).not.toBe('hacked');
  });

  it('lets a specialist patch their own row', async () => {
    const salon = await tenantService.create({ name: 'Self Setup Salon', slug: nextSlug() });
    const ownerId = await seedOwner(salon.id, nextPhone());
    const mine = await seedSpecialist(salon.id, ownerId, nextPhone());

    // The narrowing must not over-reach: the onboarding screen calls this exact
    // route with the caller's own row, and that has to keep working.
    const result = await salonService.updatePanelSpecialist(mine.user, mine.rowId, {
      bio: 'متخصص رنگ و مش',
    } as UpdateSpecialistPanelDto);
    expect(result.status).toBe('approved');

    const rows = await queryAsAdmin<{ bio: string | null; profile_completed: boolean }>(
      `SELECT bio, profile_completed FROM specialists WHERE id = $1`,
      [mine.rowId],
    );
    expect(rows[0].bio).toBe('متخصص رنگ و مش');
    expect(rows[0].profile_completed).toBe(true);
  });

  it('lets the owner patch any specialist of their salon', async () => {
    const salon = await tenantService.create({ name: 'Owner Edit Salon', slug: nextSlug() });
    const ownerPhone = nextPhone();
    const ownerId = await seedOwner(salon.id, ownerPhone);
    const staff = await seedSpecialist(salon.id, ownerId, nextPhone());
    const owner = asUser(ownerId, 'salon_owner', salon.id, ownerPhone);

    // Managing the salon means managing everyone in it, so the owner is the
    // role the ownership term must not restrict.
    const result = await salonService.updatePanelSpecialist(owner, staff.rowId, {
      bio: 'ویرایش مالک',
      isActive: true,
    } as UpdateSpecialistPanelDto);
    expect(result.status).toBe('approved');

    const rows = await queryAsAdmin<{ bio: string | null }>(
      `SELECT bio FROM specialists WHERE id = $1`,
      [staff.rowId],
    );
    expect(rows[0].bio).toBe('ویرایش مالک');
  });
});

