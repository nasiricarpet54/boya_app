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
  stats: { bookings: number; services: number; specialists: number; lines: number };
  recentBookings: TenantRecentBooking[];
}

/** `all` is a panel-only filter value; the wire type is the approval_status subset. */
export type TenantStatus = 'approved' | 'pending_approval' | 'rejected' | 'suspended';
export type TenantStatusFilter = TenantStatus | 'all';
export type TenantStatusUpdate = 'approved' | 'suspended';

export interface ListTenantsQuery {
  search?: string;
  status?: TenantStatusFilter;
  page?: number;
  /** Defaults to `TENANTS_PAGE_SIZE`; the role-dialog dropdown asks for 100. */
  limit?: number;
}

export const TENANTS_PAGE_SIZE = 20;

export const tenantsApi = {
  /** `GET /admin/tenants` — paginated, newest first. */
  listTenants(query: ListTenantsQuery = {}): Promise<TenantListPage> {
    return api
      .get<TenantListPage>('/admin/tenants', {
        params: { search: query.search || undefined, status: query.status ?? 'all', page: query.page ?? 1, limit: query.limit ?? TENANTS_PAGE_SIZE },
      })
      .then((r) => r.data);
  },

  /** `GET /admin/tenants/:id` — full record plus stats and recent bookings. */
  getTenant(id: string): Promise<TenantDetail> {
    return api.get<TenantDetail>(`/admin/tenants/${id}`).then((r) => r.data);
  },

  /** `PATCH /admin/tenants/:id/status` — approve / suspend / reactivate. */
  updateStatus(id: string, body: { status: TenantStatusUpdate; reason?: string }): Promise<TenantDetail> {
    return api.patch<TenantDetail>(`/admin/tenants/${id}/status`, body).then((r) => r.data);
  },
};
