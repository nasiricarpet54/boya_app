import api from './client';

/** Mirrors `AdminAuditLogsService` wire shapes (camelCase over the wire). */
export type AuditTargetType = 'tenant' | 'user' | 'booking';
/**
 * Chip values double as wire values: `all` drops the filter, the rest are
 * the `action` prefix the backend matches with `starts_with`.
 */
export type AuditActionFilter = 'all' | 'tenant.' | 'user.' | 'booking.';
export type AuditTargetFilter = 'all' | AuditTargetType;

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorPhone: string | null;
  action: string;
  targetType: AuditTargetType | null;
  targetId: string | null;
  targetLabel: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogListPage {
  data: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const AUDIT_PAGE_SIZE = 20;

export interface ListAuditLogsQuery {
  actorId?: string;
  /** Action prefix (`tenant.`) or a full action name (`tenant.approved`). */
  action?: string;
  targetType?: AuditTargetType;
  page?: number;
}

export const auditApi = {
  /** `GET /admin/audit-logs` — paginated, newest first. */
  listAuditLogs(query: ListAuditLogsQuery = {}): Promise<AuditLogListPage> {
    return api
      .get<AuditLogListPage>('/admin/audit-logs', {
        params: {
          actorId: query.actorId,
          action: query.action,
          targetType: query.targetType,
          page: query.page ?? 1,
          limit: AUDIT_PAGE_SIZE,
        },
      })
      .then((r) => r.data);
  },
};
