import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { APPROVAL_STATUSES, ApprovalStatus } from '../../../common/approval-status';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

export type TenantStatusTransition = 'approved' | 'suspended';

interface TenantListRow {
  id: string; name: string; slug: string | null; phone: string | null;
  status: ApprovalStatus; rating: string | null; review_count: number | string;
  bookings_count: number | string; specialists_count: number | string; created_at: Date;
}

export interface TenantListItem {
  id: string; name: string; slug: string | null; phone: string | null;
  status: ApprovalStatus; rating: number; reviewCount: number;
  bookingsCount: number; specialistsCount: number; createdAt: Date;
}

export interface TenantListPage { data: TenantListItem[]; total: number; page: number; totalPages: number; }

interface TenantDetailRow {
  id: string; name: string; name_en: string | null; slug: string | null;
  address: string | null; phone: string | null; cover_image_url: string | null;
  is_active: boolean; rating: string | null; review_count: number | string;
  working_hours: Record<string, unknown> | null; settings: Record<string, unknown> | null;
  status: ApprovalStatus; rejection_reason: string | null;
  approved_at: Date | null; approved_by: string | null;
  pending_changes: Record<string, unknown> | null; created_at: Date;
}

interface TenantCountsRow { bookings: number | string; services: number | string; specialists: number | string; lines: number | string; }

interface TenantRecentBookingRow {
  id: string; status: string; start_at: Date; end_at: Date; total_price: string | null;
  service_name: string | null; specialist_name: string | null;
  customer_name: string | null; customer_phone: string | null; created_at: Date;
}

export interface TenantRecentBooking {
  id: string; status: string; startAt: Date; endAt: Date; totalPrice: number | null;
  serviceName: string | null; specialistName: string | null;
  customerName: string | null; customerPhone: string | null; createdAt: Date;
}

export interface TenantDetail {
  id: string; name: string; nameEn: string | null; slug: string | null;
  address: string | null; phone: string | null; coverImageUrl: string | null;
  isActive: boolean; status: ApprovalStatus; rating: number; reviewCount: number;
  rejectionReason: string | null; approvedAt: Date | null; approvedBy: string | null;
  pendingChanges: Record<string, unknown> | null;
  workingHours: Record<string, unknown>; settings: Record<string, unknown>;
  createdAt: Date; stats: { bookings: number; services: number; specialists: number; lines: number };
  recentBookings: TenantRecentBooking[];
}

/** Management surface behind /admin/tenants (raw SQL: entity maps 7 cols only, bookings/lines are FORCE RLS). */
@Injectable()
export class AdminTenantsService {
  constructor(private readonly dataSource: DataSource) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (!user || user.role !== 'admin') throw new ForbiddenException('این بخش فقط برای مدیر سامانه است');
  }

  async list(user: AuthenticatedUser, query: ListTenantsQueryDto): Promise<TenantListPage> {
    this.requireAdmin(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = (query.search ?? '').trim();
    const status = query.status ?? 'all';
    const filters: string[] = [];
    const params: unknown[] = [];
    let bind = 1;
    if (status === 'all') {
      // The main list hides archived salons; they live behind status=archived.
      filters.push(`t.status <> $${bind++}::approval_status`);
      params.push('archived');
    } else if (status === 'archived') {
      filters.push(`t.status = $${bind++}::approval_status`);
      params.push(status);
    } else {
      if (!(APPROVAL_STATUSES as readonly string[]).includes(status)) {
        throw new BadRequestException(`status باید یکی از ${[...APPROVAL_STATUSES, 'all'].join('، ')} باشد`);
      }
      filters.push(`t.status = $${bind++}::approval_status`);
      params.push(status);
    }
    if (search) {
      const escaped = search.replace(/[\\%_]/g, (ch) => `\\${ch}`);
      filters.push(`(t.name ILIKE $${bind} ESCAPE '\\' OR t.slug ILIKE $${bind} ESCAPE '\\' OR t.phone ILIKE $${bind} ESCAPE '\\')`);
      params.push(`%${escaped}%`);
      bind += 1;
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await this.dataSource.query<Array<{ total: string | number }>>(
      `SELECT COUNT(*) AS total FROM tenants t ${where}`, params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const rows = await this.dataSource.query<TenantListRow[]>(
      `SELECT t.id, t.name, t.slug, t.phone, t.status, t.rating, t.review_count,
              c.bookings AS bookings_count, c.specialists AS specialists_count, t.created_at
         FROM tenants t
         CROSS JOIN LATERAL admin_tenant_counts(t.id) c
        ${where}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $${bind++} OFFSET $${bind++}`,
      [...params, limit, (page - 1) * limit],
    );
    return {
      data: rows.map((r) => ({
        id: r.id, name: r.name, slug: r.slug, phone: r.phone, status: r.status,
        rating: r.rating === null ? 0 : Number(r.rating),
        reviewCount: Number(r.review_count ?? 0),
        bookingsCount: Number(r.bookings_count ?? 0),
        specialistsCount: Number(r.specialists_count ?? 0),
        createdAt: r.created_at,
      })),
      total, page, totalPages,
    };
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<TenantDetail> {
    this.requireAdmin(user);
    const rows = await this.dataSource.query<TenantDetailRow[]>(
      `SELECT t.id, t.name, t.name_en, t.slug, t.address, t.phone, t.cover_image_url,
              t.is_active, t.rating, t.review_count, t.working_hours, t.settings,
              t.status, t.rejection_reason, t.approved_at, t.approved_by,
              t.pending_changes, t.created_at
         FROM tenants t WHERE t.id = $1::uuid`, [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('سالن مورد نظر یافت نشد');
    const [counts] = await this.dataSource.query<TenantCountsRow[]>(
      `SELECT * FROM admin_tenant_counts($1::uuid)`, [id],
    );
    const recent = await this.dataSource.query<TenantRecentBookingRow[]>(
      `SELECT * FROM admin_tenant_recent_bookings($1::uuid)`, [id],
    );
    return {
      id: row.id, name: row.name, nameEn: row.name_en, slug: row.slug,
      address: row.address, phone: row.phone, coverImageUrl: row.cover_image_url,
      isActive: row.is_active, status: row.status,
      rating: row.rating === null ? 0 : Number(row.rating),
      reviewCount: Number(row.review_count ?? 0),
      rejectionReason: row.rejection_reason, approvedAt: row.approved_at, approvedBy: row.approved_by,
      pendingChanges: row.pending_changes,
      workingHours: row.working_hours ?? {}, settings: row.settings ?? {},
      createdAt: row.created_at,
      stats: {
        bookings: Number(counts?.bookings ?? 0), services: Number(counts?.services ?? 0),
        specialists: Number(counts?.specialists ?? 0), lines: Number(counts?.lines ?? 0),
      },
      recentBookings: recent.map((b) => ({
        id: b.id, status: b.status, startAt: b.start_at, endAt: b.end_at,
        totalPrice: b.total_price === null ? null : Number(b.total_price),
        serviceName: b.service_name, specialistName: b.specialist_name,
        customerName: b.customer_name, customerPhone: b.customer_phone, createdAt: b.created_at,
      })),
    };
  }

  async updateStatus(user: AuthenticatedUser, id: string, status: TenantStatusTransition, reason?: string): Promise<TenantDetail> {
    this.requireAdmin(user);
    const current = await this.dataSource.query<Array<{ id: string; status: ApprovalStatus }>>(
      `SELECT id, status FROM tenants WHERE id = $1::uuid`, [id],
    );
    if (current.length === 0) throw new NotFoundException('سالن مورد نظر یافت نشد');
    const oldStatus = current[0]!.status;
    if (status === 'approved') {
      await this.dataSource.query(
        `UPDATE tenants SET status = 'approved', rejection_reason = NULL,
           pending_changes = NULL, approved_at = NOW(), approved_by = $2 WHERE id = $1::uuid`,
        [id, user.userId],
      );
    } else {
      await this.dataSource.query(
        `UPDATE tenants SET status = 'suspended', rejection_reason = $3,
           approved_at = NULL, approved_by = NULL WHERE id = $1::uuid`,
        [id, user.userId, reason ?? null],
      );
    }
    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, tenant_id, action, old_status, new_status, reason)
       VALUES ($1::uuid, $2::uuid, $3, $4::approval_status, $5::approval_status, $6)`,
      [user.userId, id, status === 'approved' ? 'tenant.approved' : 'tenant.suspended', oldStatus, status, reason ?? null],
    );
    return this.findOne(user, id);
  }

  /**
   * Edit the public fields of a salon. `tenants` carries no RLS (see the
   * migration note on 1730000000023), so the write is a plain UPDATE — the
   * same reason `updateStatus` above does not need a SECURITY DEFINER helper.
   *
   * Only fields the caller actually sent are written: an absent property is
   * `undefined`, and folding those into the SET clause would null out columns
   * the client never meant to touch. A new `slug` is uniqueness-checked first
   * (the global `uq_tenants_slug` constraint surfaces as a 409 rather than a
   * raw 23505), and a supplied `categoryId` must name a real
   * `service_categories` row. The transition is audited, then the refreshed
   * detail is returned so the caller sees the same shape as `findOne`.
   */
  async update(user: AuthenticatedUser, id: string, dto: UpdateTenantDto): Promise<TenantDetail> {
    this.requireAdmin(user);
    const current = await this.dataSource.query<Array<{ id: string; slug: string | null }>>(
      `SELECT id, slug FROM tenants WHERE id = $1::uuid`,
      [id],
    );
    if (current.length === 0) throw new NotFoundException('سالن مورد نظر یافت نشد');

    // Only a *changed* slug needs the uniqueness probe; re-sending the current
    // one would 409 against its own row.
    if (dto.slug !== undefined && dto.slug !== current[0]!.slug) {
      const clash = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM tenants WHERE slug = $1 AND id <> $2::uuid`,
        [dto.slug, id],
      );
      if (clash.length > 0) throw new ConflictException('این اسلاگ قبلاً استفاده شده است');
    }

    if (dto.categoryId !== undefined) {
      const categories = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM service_categories WHERE id = $1::uuid`,
        [dto.categoryId],
      );
      if (categories.length === 0) throw new NotFoundException('دسته‌بندی مورد نظر یافت نشد');
    }

    // Build the SET list from only the defined fields; bind parameters in order.
    const sets: string[] = [];
    const params: unknown[] = [];
    let bind = 1;
    const set = (column: string, value: unknown): void => {
      sets.push(`${column} = $${bind++}`);
      params.push(value);
    };
    if (dto.name !== undefined) set('name', dto.name);
    if (dto.nameEn !== undefined) set('name_en', dto.nameEn);
    if (dto.slug !== undefined) set('slug', dto.slug);
    if (dto.address !== undefined) set('address', dto.address);
    if (dto.phone !== undefined) set('phone', dto.phone);
    if (dto.categoryId !== undefined) set('category_id', dto.categoryId);
    if (dto.discountPercent !== undefined) set('discount_percent', dto.discountPercent);
    if (dto.isFeatured !== undefined) set('is_featured', dto.isFeatured);

    if (sets.length > 0) {
      await this.dataSource.query(
        `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${bind}::uuid`,
        [...params, id],
      );
    }

    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, tenant_id, action, reason)
       VALUES ($1::uuid, $2::uuid, $3, $4)`,
      [
        user.userId,
        id,
        'tenant.updated',
        `fields:${Object.keys(dto).join(',') || 'none'}`,
      ],
    );

    return this.findOne(user, id);
  }

  /**
   * Archive a salon: flip `is_active = false` and `status = 'archived'`
   * rather than removing the row, so its bookings/history stay intact and the
   * action is reversible via `restore`. Archived salons are hidden from the
   * default list (`list` filters them out unless `status=archived`). Like
   * `update`, `tenants` has no RLS so the write is a plain UPDATE. The
   * transition is audited with the before/after status.
   */
  async softDelete(user: AuthenticatedUser, id: string): Promise<{ success: true; message: string }> {
    this.requireAdmin(user);
    const current = await this.dataSource.query<Array<{ id: string; status: ApprovalStatus }>>(
      `SELECT id, status FROM tenants WHERE id = $1::uuid`,
      [id],
    );
    if (current.length === 0) throw new NotFoundException('سالن مورد نظر یافت نشد');
    const oldStatus = current[0]!.status;

    await this.dataSource.query(
      `UPDATE tenants SET is_active = false, status = 'archived' WHERE id = $1::uuid`,
      [id],
    );

    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, tenant_id, action, old_status, new_status)
       VALUES ($1::uuid, $2::uuid, $3, $4::approval_status, 'archived')`,
      [user.userId, id, 'tenant.archived', oldStatus],
    );

    return { success: true, message: 'سالن آرشیو شد و از لیست اصلی ناپدید میشود' };
  }

  /**
   * Restore an archived salon: only `archived` rows can come back, and they
   * return as `approved` + `is_active = true` with a fresh `approved_at`.
   */
  async restore(user: AuthenticatedUser, id: string): Promise<{ success: true; message: string }> {
    this.requireAdmin(user);
    const current = await this.dataSource.query<Array<{ id: string; status: ApprovalStatus }>>(
      `SELECT id, status FROM tenants WHERE id = $1::uuid`,
      [id],
    );
    if (current.length === 0) throw new NotFoundException('سالن مورد نظر یافت نشد');
    if (current[0]!.status !== 'archived') throw new BadRequestException('این سالن آرشیو نشده');

    await this.dataSource.query(
      `UPDATE tenants SET status = 'approved', is_active = true, approved_at = NOW() WHERE id = $1::uuid`,
      [id],
    );

    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, tenant_id, action, old_status, new_status)
       VALUES ($1::uuid, $2::uuid, $3, 'archived', 'approved')`,
      [user.userId, id, 'tenant.restored'],
    );

    return { success: true, message: 'سالن بازگردانی شد' };
  }
}
