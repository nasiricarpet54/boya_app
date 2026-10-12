import api from './client';

/** Mirrors `AdminTenantsService.TenantListItem` (camelCase over the wire). */
export interface TenantListItem {
  id: string;
  name: string;
  slug: string | null;
  phone: string | null;
  status: TenantStatus;
  rating: number;
  reviewCount: number;
  bookingsCount: number;
  specialistsCount: number;
  createdAt: string;
  cityName: string | null;
  provinceName: string | null;
}

export interface TenantListPage {
  data: TenantListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface TenantRecentBooking {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  totalPrice: number | null;
  serviceName: string | null;
  specialistName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
}

/**
 * One side of the tenant's loose location link (migration 1730000000038).
 * Mirrors `AdminTenantsService.TenantLocationRef`: the id is always present when
 * the ref itself is, the names degrade to an empty string if the joined row is
 * gone — the link is intentionally not FK-cascaded.
 */
export interface TenantLocationRef {
  id: string;
  nameFa: string;
  nameEn: string;
}

/** Mirrors `AdminTenantsService.TenantDetail`. */
export interface TenantDetail {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string | null;
  address: string | null;
  phone: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  status: TenantStatus;
  rating: number;
  reviewCount: number;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  pendingChanges: Record<string, unknown> | null;
  workingHours: Record<string, unknown>;
  settings: Record<string, unknown>;
  createdAt: string;
  provinceId: string | null;
  cityId: string | null;
  province: TenantLocationRef | null;
  city: TenantLocationRef | null;
  stats: { bookings: number; services: number; specialists: number; lines: number };
  recentBookings: TenantRecentBooking[];
}

/** `all` is a panel-only filter value; the wire type is the approval_status subset. */
export type TenantStatus = 'approved' | 'pending_approval' | 'rejected' | 'suspended' | 'archived';
export type TenantStatusFilter = TenantStatus | 'all';
export type TenantStatusUpdate = 'approved' | 'suspended';

/** Body of `PATCH /admin/tenants/:id` (edit of the public salon fields). */
export interface UpdateTenantBody {
  name?: string;
  nameEn?: string;
  slug?: string;
  address?: string;
  phone?: string;
  categoryId?: string;
  discountPercent?: number;
  isFeatured?: boolean;
  /** `null` clears the link; omitted leaves it untouched. */
  provinceId?: string | null;
  cityId?: string | null;
}

export interface ListTenantsQuery {
  search?: string;
  status?: TenantStatusFilter;
  page?: number;
  /** Defaults to `TENANTS_PAGE_SIZE`; the role-dialog dropdown asks for 100. */
  limit?: number;
  provinceId?: string;
  cityId?: string;
}

export const TENANTS_PAGE_SIZE = 20;

/**
 * `POST /tenants` — the minimal payload a new salon needs (ADR-010 step 1).
 * The location ids are optional and loose; the pair is validated server-side
 * (a city must belong to its province).
 */
export interface CreateTenantBody {
  name: string;
  /** URL-safe, lowercase `[a-z0-9-]`; the backend rejects anything else. */
  slug: string;
  provinceId?: string | null;
  cityId?: string | null;
}

/** The created tenant, as `POST /tenants` returns it. A fresh salon is `draft`. */
export interface CreatedTenant {
  id: string;
  name: string;
  slug: string | null;
  status: 'draft' | TenantStatus;
}

export const tenantsApi = {
  /** `GET /admin/tenants` — paginated, newest first. */
  listTenants(query: ListTenantsQuery = {}): Promise<TenantListPage> {
    return api
      .get<TenantListPage>('/admin/tenants', {
        params: {
          search: query.search || undefined,
          status: query.status ?? 'all',
          page: query.page ?? 1,
          limit: query.limit ?? TENANTS_PAGE_SIZE,
          provinceId: query.provinceId || undefined,
          cityId: query.cityId || undefined,
        },
      })
      .then((r) => r.data);
  },

  /**
   * `POST /tenants` — creates a salon. Admin-only; the panel signs in as
   * `admin`, so no tenant header is needed. The new salon starts in `draft`
   * and is published only once an admin approves it.
   */
  createTenant(body: CreateTenantBody): Promise<CreatedTenant> {
    return api.post<CreatedTenant>('/tenants', body).then((r) => r.data);
  },

  /** `GET /admin/tenants/:id` — full record plus stats and recent bookings. */
  getTenant(id: string): Promise<TenantDetail> {
    return api.get<TenantDetail>(`/admin/tenants/${id}`).then((r) => r.data);
  },

  /** `PATCH /admin/tenants/:id/status` — approve / suspend / reactivate. */
  updateStatus(id: string, body: { status: TenantStatusUpdate; reason?: string }): Promise<TenantDetail> {
    return api.patch<TenantDetail>(`/admin/tenants/${id}/status`, body).then((r) => r.data);
  },

  /**
   * `PATCH /admin/tenants/:id` — edit public salon fields (name, slug, address,
   * phone, category, discount, featured) plus the optional province/city link.
   * An omitted field is left untouched; an explicit `null` clears the link.
   */
  updateTenant(id: string, body: UpdateTenantBody): Promise<TenantDetail> {
    return api.patch<TenantDetail>(`/admin/tenants/${id}`, body).then((r) => r.data);
  },

  /** `DELETE /admin/tenants/:id` — archive (is_active=false, status=archived). */
  deleteTenant(id: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/admin/tenants/${id}`).then((r) => r.data);
  },

  /** `POST /admin/tenants/:id/restore` — restore an archived salon. */
  restoreTenant(id: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(`/admin/tenants/${id}/restore`).then((r) => r.data);
  },
};
