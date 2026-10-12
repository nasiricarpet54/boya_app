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
  city_name: string | null; province_name: string | null;
}

export interface TenantListItem {
  id: string; name: string; slug: string | null; phone: string | null;
  status: ApprovalStatus; rating: number; reviewCount: number;
  bookingsCount: number; specialistsCount: number; createdAt: Date;
  cityName: string | null; provinceName: string | null;
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
  city_id: string | null; province_id: string | null;
  city_name_fa: string | null; city_name_en: string | null;
  province_name_fa: string | null; province_name_en: string | null;
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

/**
 * A resolved province/city link (migration 1730000000038). `null` when the
 * salon never picked one, or when the reference row was deleted — the schema
 * keeps the link loose (no ON DELETE CASCADE) so a tenant is never orphaned.
 */
export interface TenantLocationRef {
  id: string;
  nameFa: string;
  nameEn: string;
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
  provinceId: string | null;
  cityId: string | null;
  province: TenantLocationRef | null;
  city: TenantLocationRef | null;
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
    // Optional location drill-down (migration 1730000000038). Both are plain
    // uuid equality checks on indexed, partial-key columns; a null id simply
    // never matches, which is the intent.
    if (query.provinceId) {
      filters.push(`t.province_id = $${bind++}::uuid`);
      params.push(query.provinceId);
    }
    if (query.cityId) {
      filters.push(`t.city_id = $${bind++}::uuid`);
      params.push(query.cityId);
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await this.dataSource.query<Array<{ total: string | number }>>(
      `SELECT COUNT(*) AS total FROM tenants t ${where}`, params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const rows = await this.dataSource.query<TenantListRow[]>(
      `SELECT t.id, t.name, t.slug, t.phone, t.status, t.rating, t.review_count,
              c.bookings AS bookings_count, c.specialists AS specialists_count, t.created_at,
              ci.name_fa AS city_name, pr.name_fa AS province_name
         FROM tenants t
         CROSS JOIN LATERAL admin_tenant_counts(t.id) c
         LEFT JOIN cities ci ON ci.id = t.city_id
         LEFT JOIN provinces pr ON pr.id = t.province_id
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
        cityName: r.city_name,
        provinceName: r.province_name,
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
              t.pending_changes, t.created_at,
              t.city_id, t.province_id,
              ci.name_fa AS city_name_fa, ci.name_en AS city_name_en,
              pr.name_fa AS province_name_fa, pr.name_en AS province_name_en
         FROM tenants t
         LEFT JOIN cities ci ON ci.id = t.city_id
         LEFT JOIN provinces pr ON pr.id = t.province_id
        WHERE t.id = $1::uuid`, [id],
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
      provinceId: row.province_id,
      cityId: row.city_id,
      // The join resolves the names in one round trip; a dangling id (the city
      // row was deleted) still reports the id with empty names rather than 500.
      province: row.province_id
        ? { id: row.province_id, nameFa: row.province_name_fa ?? '', nameEn: row.province_name_en ?? '' }
        : null,
      city: row.city_id
        ? { id: row.city_id, nameFa: row.city_name_fa ?? '', nameEn: row.city_name_en ?? '' }
        : null,
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
   * raw 23505), a supplied `categoryId` must name a real
   * `service_categories` row, and a supplied `cityId` / `provinceId` must name
   * real `cities` / `provinces` rows — and agree with each other, since a city
   * belongs to exactly one province. The transition is audited, then the
   * refreshed detail is returned so the caller sees the same shape as
   * `findOne`.
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

    // Location links (migration 1730000000038). Like categoryId, a supplied id
    // is checked against the reference table so a bad uuid answers 404 instead
    // of a raw FK violation surfacing as a 500. `null` is an explicit clear and
    // is written straight through, the same as every other optional field.
    if (dto.provinceId !== undefined && dto.provinceId !== null) {
      const provinces = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM provinces WHERE id = $1::uuid`,
        [dto.provinceId],
      );
      if (provinces.length === 0) throw new NotFoundException('استان مورد نظر یافت نشد');
    }
    if (dto.cityId !== undefined && dto.cityId !== null) {
      const cities = await this.dataSource.query<Array<{ id: string; province_id: string }>>(
        `SELECT id, province_id FROM cities WHERE id = $1::uuid`,
        [dto.cityId],
      );
      if (cities.length === 0) throw new NotFoundException('شهر مورد نظر یافت نشد');
      // Keep the pair consistent: a city implies its province. When the caller
      // names a province too it must agree, otherwise the two columns would
      // contradict each other the moment this statement commits.
      if (dto.provinceId !== undefined && dto.provinceId !== null) {
        if (cities[0]!.province_id !== dto.provinceId) {
          throw new BadRequestException('شهر مورد نظر به این استان تعلق ندارد');
        }
      } else {
        dto.provinceId = cities[0]!.province_id;
      }
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
    if (dto.provinceId !== undefined) set('province_id', dto.provinceId);
    if (dto.cityId !== undefined) set('city_id', dto.cityId);

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
