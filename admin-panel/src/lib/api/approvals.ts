import api from './client';

/**
 * Admin approval queue — mirrors `ApprovalsService.ApprovalItem`.
 * `pending_changes` only exists on `tenants`; the other two types send `null`.
 */
export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  name: string | null;
  tenantId: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string | null;
  pendingChanges: Record<string, unknown> | null;
}

export type ApprovalPage = {
  data: ApprovalItem[];
  total: number;
};

/** Kept in sync with `backend/src/common/approval-status.ts`. */
export const APPROVAL_TYPES = ['tenant', 'service_line', 'specialist'] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'suspended',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalQuery {
  type?: ApprovalType;
  status?: ApprovalStatus;
  /** Accepted and forwarded; the backend currently answers the whole queue. */
  page?: number;
}

export const approvalsApi = {
  /**
   * `GET /admin/approvals`. Omitting `status` lets the backend apply its own
   * default of `pending_approval`; an unknown value is rejected there with a
   * 400 before any SQL runs.
   */
  list(query: ApprovalQuery = {}): Promise<ApprovalPage> {
    return api.get<ApprovalPage>('/admin/approvals', { params: query }).then((r) => r.data);
  },

  /**
   * `POST /admin/approvals/:type/:id/approve` — applies the request at once.
   * For a tenant the stored `pending_changes` are merged into the live row.
   */
  approveItem(type: ApprovalType, id: string): Promise<ApprovalItem> {
    return api
      .post<ApprovalItem>(`/admin/approvals/${type}/${id}/approve`)
      .then((r) => r.data);
  },

  /**
   * `POST /admin/approvals/:type/:id/reject` — stores the reason and drops
   * `pending_changes`. The reason is mandatory on both sides of the wire.
   */
  rejectItem(type: ApprovalType, id: string, reason: string): Promise<ApprovalItem> {
    return api
      .post<ApprovalItem>(`/admin/approvals/${type}/${id}/reject`, { reason })
      .then((r) => r.data);
  },
};
