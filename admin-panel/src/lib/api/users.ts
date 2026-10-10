import api from './client';
import type { UserRole } from '../stores/auth';

/** Mirrors `AdminUsersService` wire shapes (camelCase). */
export type UserStatusFilter = 'active' | 'inactive' | 'all';

export interface UserListItem {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  tenantId: string | null;
  tenantName: string | null;
  createdAt: string;
  /** Tracked nowhere yet; kept in the contract for when login events land. */
  lastLoginAt: string | null;
}

export interface UserListPage {
  data: UserListItem[];
  total: number;
  page: number;
  totalPages: number;
  counts: Record<UserRole, number>;
}

export interface UserBooking {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  totalPrice: number | null;
  serviceName: string | null;
  specialistName: string | null;
  tenantName: string | null;
  createdAt: string;
}

export interface UserAuditEntry {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  createdAt: string;
}

export interface UserDetail extends UserListItem {
  bookingsCount: number;
  lastBookings: UserBooking[];
  auditTrail: UserAuditEntry[];
}

export interface UserUpdateResult {
  id: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
}

/** Contract of `POST /admin/users`. */
export interface UserCreateResult {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
  /** True when a `specialists` row was auto-created alongside the user. */
  specialistCreated: boolean;
}

/** Body of `POST /admin/users`. */
export interface CreateUserBody {
  /** Iranian mobile in `09XXXXXXXXX` form; the backend normalises and rejects dupes with 409. */
  phone: string;
  role: UserRole;
  fullName?: string;
  /** Required for `salon_owner` / `line_manager` / `specialist`; ignored otherwise. */
  tenantId?: string;
}

export interface ListUsersQuery {
  search?: string;
  role?: UserRole | 'all';
  status?: UserStatusFilter;
  page?: number;
}

export const USERS_PAGE_SIZE = 20;

export const usersApi = {
  /** `GET /admin/users` — paginated, newest first, with per-role counts. */
  listUsers(query: ListUsersQuery = {}): Promise<UserListPage> {
    return api
      .get<UserListPage>('/admin/users', {
        params: {
          search: query.search || undefined,
          role: query.role ?? 'all',
          status: query.status ?? 'all',
          page: query.page ?? 1,
          limit: USERS_PAGE_SIZE,
        },
      })
      .then((r) => r.data);
  },

  /** `GET /admin/users/:id` — profile + stats + 5 recent bookings + audit trail. */
  getUser(id: string): Promise<UserDetail> {
    return api.get<UserDetail>(`/admin/users/${id}`).then((r) => r.data);
  },

  /** `PATCH /admin/users/:id/role` — `tenantId` required for tenant-scoped roles. */
  updateRole(id: string, body: { role: UserRole; tenantId?: string }): Promise<UserUpdateResult> {
    return api.patch<UserUpdateResult>(`/admin/users/${id}/role`, body).then((r) => r.data);
  },

  /** `PATCH /admin/users/:id/status` — activate / deactivate. */
  updateStatus(id: string, body: { isActive: boolean; reason?: string }): Promise<UserUpdateResult> {
    return api.patch<UserUpdateResult>(`/admin/users/${id}/status`, body).then((r) => r.data);
  },

  /**
   * `PATCH /admin/users/:id` — edit the user's display name. The backend
   * answers with the full `UserDetail`, so callers can refresh in place.
   */
  updateUser(id: string, body: { fullName?: string }): Promise<UserDetail> {
    return api.patch<UserDetail>(`/admin/users/${id}`, body).then((r) => r.data);
  },

  /**
   * `POST /admin/users` — create a user. A duplicate phone answers 409. For
   * `specialist` the backend also creates the `specialists` row.
   */
  createUser(body: CreateUserBody): Promise<UserCreateResult> {
    return api.post<UserCreateResult>('/admin/users', body).then((r) => r.data);
  },

  /**
   * `DELETE /admin/users/:id` — soft delete (`is_active = false`, plus the
   * specialist row). Self-delete is refused with 400; a missing id is 404.
   */
  deleteUser(id: string): Promise<{ success: true }> {
    return api.delete<{ success: true }>(`/admin/users/${id}`).then((r) => r.data);
  },
};
