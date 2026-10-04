import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { UserRole } from '../../user/entities/user.entity';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

export const ADMIN_USER_ROLES: readonly UserRole[] = [
  'customer',
  'salon_owner',
  'line_manager',
  'specialist',
  'admin',
] as const;

/** Roles that must belong to a tenant. `customer`/`admin` are tenant-free. */
const TENANT_SCOPED_ROLES: readonly UserRole[] = [
  'salon_owner',
  'line_manager',
  'specialist',
] as const;

export interface AdminUserListItem {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  tenantId: string | null;
  tenantName: string | null;
  createdAt: Date;
  lastLoginAt: null;
}

export interface AdminUserListPage {
  data: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
  counts: Record<UserRole, number>;
}

interface AdminUserRow {
  id: string;
  phone: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  tenant_id: string | null;
  tenant_name: string | null;
  created_at: Date;
  bookings_count: number | string;
}

interface AdminUserBookingRow {
  id: string;
  status: string;
  start_at: Date;
  end_at: Date;
  total_price: string | null;
  service_name: string | null;
  specialist_name: string | null;
  tenant_name: string | null;
  created_at: Date;
}

export interface AdminUserBooking {
  id: string;
  status: string;
  startAt: Date;
  endAt: Date;
  totalPrice: number | null;
  serviceName: string | null;
  specialistName: string | null;
  tenantName: string | null;
  createdAt: Date;
}

interface AdminUserAuditRow {
  id: string;
  actor_id: string | null;
  tenant_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: Date;
}

export interface AdminUserAuditEntry {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface AdminUserDetail extends AdminUserListItem {
  bookingsCount: number;
  lastBookings: AdminUserBooking[];
  auditTrail: AdminUserAuditEntry[];
}

/** Contract of both PATCH endpoints. */
export interface UserUpdateResult {
  id: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
}

/**
 * Management surface behind /admin/users (raw SQL through SECURITY DEFINER
 * functions: `users` and `bookings` are FORCE RLS on tenant settings an
 * admin JWT does not carry).
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly dataSource: DataSource) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('این بخش فقط برای مدیر سامانه است');
    }
  }

  private static assertRole(value: string | undefined): UserRole {
    if (!value || !(ADMIN_USER_ROLES as readonly string[]).includes(value)) {
      throw new BadRequestException(
        `role باید یکی از ${ADMIN_USER_ROLES.join('، ')} باشد`,
      );
    }
    return value as UserRole;
  }

  private toListItem(r: AdminUserRow): AdminUserListItem {
    return {
      id: r.id,
      phoneNumber: r.phone,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      role: r.role,
      isActive: r.is_active,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      createdAt: r.created_at,
      // No login tracking column exists; the contract keeps the nullable
      // field so the panel can render it without branching.
      lastLoginAt: null,
    };
  }

  async list(
    user: AuthenticatedUser,
    query: ListUsersQueryDto,
  ): Promise<AdminUserListPage> {
    this.requireAdmin(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = (query.search ?? '').trim();
    const role = query.role ?? 'all';
    const status = query.status ?? 'all';

    const filters: string[] = [];
    const params: unknown[] = [];
    let bind = 1;
    if (role !== 'all') {
      AdminUsersService.assertRole(role);
      filters.push(`u.role = $${bind++}`);
      params.push(role);
    }
    if (status !== 'all') {
      if (status !== 'active' && status !== 'inactive') {
        throw new BadRequestException(
          'status باید یکی از active، inactive یا all باشد',
        );
      }
      filters.push(`u.is_active = $${bind++}`);
      params.push(status === 'active');
    }
    if (search) {
      const escaped = search.replace(/[\\%_]/g, (ch) => `\\${ch}`);
      filters.push(
        `(u.full_name ILIKE $${bind} ESCAPE '\\' OR u.phone ILIKE $${bind} ESCAPE '\\')`,
      );
      params.push(`%${escaped}%`);
      bind += 1;
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Counts ride on the unfiltered definer output so chips stay absolute
    // while the table shows the filtered page.
    const countsRows = await this.dataSource.query<
      Array<{ role: string; total: number | string }>
    >(
      `SELECT u.role AS role, COUNT(*) AS total FROM admin_users_all() u GROUP BY u.role`,
    );
    const counts: Record<UserRole, number> = {
      customer: 0,
      salon_owner: 0,
      line_manager: 0,
      specialist: 0,
      admin: 0,
    };
    for (const row of countsRows) {
      if ((ADMIN_USER_ROLES as readonly string[]).includes(row.role)) {
        counts[row.role as UserRole] = Number(row.total ?? 0);
      }
    }

    const countRows = await this.dataSource.query<
      Array<{ total: number | string }>
    >(`SELECT COUNT(*) AS total FROM admin_users_all() u ${where}`, params);
    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const rows = await this.dataSource.query<AdminUserRow[]>(
      `SELECT u.id, u.phone, u.full_name, u.avatar_url, u.role, u.is_active,
              u.tenant_id, u.tenant_name, u.created_at, u.bookings_count
         FROM admin_users_all() u
         ${where}
         ORDER BY u.created_at DESC, u.id DESC
         LIMIT $${bind++} OFFSET $${bind++}`,
      [...params, limit, (page - 1) * limit],
    );

    return {
      data: rows.map((r) => this.toListItem(r)),
      total,
      page,
      totalPages,
      counts,
    };
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<AdminUserDetail> {
    this.requireAdmin(user);
    const rows = await this.dataSource.query<AdminUserRow[]>(
      `SELECT u.id, u.phone, u.full_name, u.avatar_url, u.role, u.is_active,
              u.tenant_id, u.tenant_name, u.created_at, u.bookings_count
         FROM admin_users_all() u
        WHERE u.id = $1::uuid`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('کاربر مورد نظر یافت نشد');

    const recent = await this.dataSource.query<AdminUserBookingRow[]>(
      `SELECT * FROM admin_user_recent_bookings($1::uuid)`,
      [id],
    );
    // `audit_logs` carries no RLS, so the trail is two plain reads combined:
    // actions this user performed (as actor) and transitions where this user
    // was the subject (target stamped into `reason` as `user:<uuid>`).
    const trail = await this.dataSource.query<AdminUserAuditRow[]>(
      `SELECT a.id, a.actor_id, a.tenant_id, a.action,
              a.old_status::TEXT AS old_status, a.new_status::TEXT AS new_status,
              a.reason, a.created_at
         FROM audit_logs a
        WHERE a.actor_id = $1::uuid
           OR a.reason LIKE '%' || $2 || '%'
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 5`,
      [id, `user:${id}`],
    );

    return {
      ...this.toListItem(row),
      bookingsCount: Number(row.bookings_count ?? 0),
      lastBookings: recent.map((b) => ({
        id: b.id,
        status: b.status,
        startAt: b.start_at,
        endAt: b.end_at,
        totalPrice: b.total_price === null ? null : Number(b.total_price),
        serviceName: b.service_name,
        specialistName: b.specialist_name,
        tenantName: b.tenant_name,
        createdAt: b.created_at,
      })),
      auditTrail: trail.map((a) => ({
        id: a.id,
        actorId: a.actor_id,
        tenantId: a.tenant_id,
        action: a.action,
        oldStatus: a.old_status,
        newStatus: a.new_status,
        reason: a.reason,
        createdAt: a.created_at,
      })),
    };
  }

  /**
   * Role transition + tenant binding. The tenant rules come straight from
   * the contract: tenant-scoped roles demand a `tenantId`, `customer` and
   * `admin` clear it. Self-edit and last-admin demotion are refused before
   * any write. The audit row stores the before/after in `reason`
   * (`user:<id> old=… new=…`): `old_status`/`new_status` are typed as the
   * `approval_status` enum and cannot hold a role.
   */
  async updateRole(
    user: AuthenticatedUser,
    id: string,
    role: UserRole,
    tenantId?: string,
  ): Promise<UserUpdateResult> {
    this.requireAdmin(user);
    if (user.userId === id) {
      throw new BadRequestException('نمی‌توانید نقش خودتان را تغییر دهید');
    }

    const current = await this.dataSource.query<
      Array<{ id: string; role: UserRole; tenant_id: string | null; is_active: boolean }>
    >(
      `SELECT u.id, u.role, u.tenant_id, u.is_active
         FROM admin_users_all() u
        WHERE u.id = $1::uuid`,
      [id],
    );
    const target = current[0];
    if (!target) throw new NotFoundException('کاربر مورد نظر یافت نشد');

    let nextTenantId: string | null = null;
    if (TENANT_SCOPED_ROLES.includes(role)) {
      if (!tenantId) {
        throw new BadRequestException('برای این نقش انتخاب سالن الزامی است');
      }
      const tenants = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM tenants WHERE id = $1::uuid`,
        [tenantId],
      );
      if (tenants.length === 0) throw new NotFoundException('سالن مورد نظر یافت نشد');
      nextTenantId = tenantId;
    }

    // Demoting the final admin would lock every future admin out.
    if (target.role === 'admin' && role !== 'admin') {
      const admins = await this.dataSource.query<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total FROM admin_users_all() u WHERE u.role = 'admin'`,
      );
      if (Number(admins[0]?.total ?? 0) <= 1) {
        throw new BadRequestException('حداقل یک ادمین باید وجود داشته باشد');
      }
    }

    const applied = await this.dataSource.query<
      Array<{ admin_apply_user_role: boolean }>
    >(`SELECT admin_apply_user_role($1::uuid, $2, $3::uuid)`, [id, role, nextTenantId]);
    if (!applied[0]?.admin_apply_user_role) {
      throw new NotFoundException('کاربر مورد نظر یافت نشد');
    }

    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, tenant_id, action, reason)
       VALUES ($1::uuid, $2::uuid, $3, $4)`,
      [
        user.userId,
        nextTenantId,
        'user.role_changed',
        `user:${id} old=${target.role} new=${role} tenant=${nextTenantId ?? 'null'}`,
      ],
    );

    return { id, role, tenantId: nextTenantId, isActive: target.is_active };
  }

  /** Active-flag flip; self-edit is refused, the transition is audited. */
  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    isActive: boolean,
    reason?: string,
  ): Promise<UserUpdateResult> {
    this.requireAdmin(user);
    if (user.userId === id) {
      throw new BadRequestException('نمی‌توانید وضعیت خودتان را تغییر دهید');
    }

    const current = await this.dataSource.query<
      Array<{ id: string; role: UserRole; tenant_id: string | null; is_active: boolean }>
    >(
      `SELECT u.id, u.role, u.tenant_id, u.is_active
         FROM admin_users_all() u
        WHERE u.id = $1::uuid`,
      [id],
    );
    const target = current[0];
    if (!target) throw new NotFoundException('کاربر مورد نظر یافت نشد');
    if (target.is_active === isActive) {
      throw new BadRequestException('وضعیت کاربر تغییری نکرده است');
    }

    const applied = await this.dataSource.query<
      Array<{ admin_apply_user_status: boolean }>
    >(`SELECT admin_apply_user_status($1::uuid, $2)`, [id, isActive]);
    if (!applied[0]?.admin_apply_user_status) {
      throw new NotFoundException('کاربر مورد نظر یافت نشد');
    }

    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, tenant_id, action, reason)
       VALUES ($1::uuid, $2::uuid, $3, $4)`,
      [
        user.userId,
        target.tenant_id,
        'user.status_changed',
        `user:${id} old=${target.is_active ? 'active' : 'inactive'} new=${isActive ? 'active' : 'inactive'}${reason ? ` reason=${reason}` : ''}`,
      ],
    );

    return { id, role: target.role, tenantId: target.tenant_id, isActive };
  }
}

