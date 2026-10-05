import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/** Action domains the panel turns into targetType values and filter chips. */
export type AuditTargetType = 'tenant' | 'user' | 'booking';

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  tenant_id: string | null;
  action: string;
  reason: string | null;
  created_at: Date;
}

interface AuditTarget {
  type: AuditTargetType | null;
  id: string | null;
}

interface UserContact {
  fullName: string | null;
  phone: string | null;
}

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
  createdAt: Date;
}

export interface AuditLogListPage {
  data: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Read surface behind GET /admin/audit-logs.
 *
 * `audit_logs` carries no RLS (migration 1730000000023), so the listing is a
 * plain read ordered createdAt DESC. Names cannot be plain joins, though:
 * `users` is FORCE ROW LEVEL SECURITY and an admin JWT carries no tenant
 * setting, so actors and user subjects are resolved through the SECURITY
 * DEFINER `admin_users_all()` (one pass per page), and salons through
 * `tenants`, which has no RLS at all.
 *
 * The target triple is derived, never stored: the domain before the first dot
 * of `action` is the targetType, a `tenant.*` action points at the row's own
 * `tenant_id`, and a `user.*` action stamps its subject into `reason` as
 * `user:<uuid> <payload>`. No `booking.*` writer exists in Phase 1, so those
 * keep a null id/label until one lands.
 */
@Injectable()
export class AdminAuditLogsService {
  private static readonly STAMPED_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  constructor(private readonly dataSource: DataSource) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('این بخش فقط برای مدیر سامانه است');
    }
  }

  /** Subject uuid stamped at the head of `reason`; null when absent or malformed. */
  private static stampedId(reason: string | null): string | null {
    const head = (reason ?? '').split(' ')[0] ?? '';
    const id = head.includes(':') ? head.slice(head.indexOf(':') + 1) : '';
    return AdminAuditLogsService.STAMPED_UUID.test(id) ? id : null;
  }

  private static readTarget(row: AuditLogRow): AuditTarget {
    const [domain] = row.action.split('.');
    if (domain === 'tenant') return { type: 'tenant', id: row.tenant_id };
    if (domain === 'user' || domain === 'booking') {
      return { type: domain, id: AdminAuditLogsService.stampedId(row.reason) };
    }
    return { type: null, id: null };
  }

  /** One definer pass for every user on the page (actors and user subjects). */
  private async resolveUsers(ids: string[]): Promise<Map<string, UserContact>> {
    const unique = [...new Set(ids)];
    const map = new Map<string, UserContact>();
    if (unique.length === 0) return map;

    const rows = await this.dataSource.query<
      Array<{ id: string; full_name: string | null; phone: string | null }>
    >(`SELECT id, full_name, phone FROM admin_users_all() WHERE id = ANY($1::uuid[])`, [unique]);
    for (const row of rows) {
      map.set(row.id, { fullName: row.full_name, phone: row.phone });
    }
    return map;
  }

  private async resolveTenants(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    const map = new Map<string, string>();
    if (unique.length === 0) return map;

    const rows = await this.dataSource.query<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM tenants WHERE id = ANY($1::uuid[])`,
      [unique],
    );
    for (const row of rows) map.set(row.id, row.name);
    return map;
  }

  async list(user: AuthenticatedUser, query: ListAuditLogsQueryDto): Promise<AuditLogListPage> {
    this.requireAdmin(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filters: string[] = [];
    const params: unknown[] = [];
    let bind = 1;
    if (query.actorId) {
      filters.push(`a.actor_id = $${bind++}::uuid`);
      params.push(query.actorId);
    }
    const action = (query.action ?? '').trim();
    if (action) {
      // `starts_with` rather than LIKE so `_` inside action names never
      // turns into a single-character wildcard.
      filters.push(`starts_with(a.action, $${bind++})`);
      params.push(action);
    }
    if (query.targetType) {
      filters.push(`split_part(a.action, '.', 1) = $${bind++}`);
      params.push(query.targetType);
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const countRows = await this.dataSource.query<Array<{ total: number | string }>>(
      `SELECT COUNT(*) AS total FROM audit_logs a ${where}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const rows = await this.dataSource.query<AuditLogRow[]>(
      `SELECT a.id, a.actor_id, a.tenant_id, a.action, a.reason, a.created_at
         FROM audit_logs a
         ${where}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT $${bind++} OFFSET $${bind++}`,
      [...params, limit, (page - 1) * limit],
    );

    const targets = rows.map((row) => AdminAuditLogsService.readTarget(row));
    const userIds = rows.flatMap((row, index) => {
      const target = targets[index]!;
      const subject = target.type === 'user' && target.id ? [target.id] : [];
      return row.actor_id ? [row.actor_id, ...subject] : subject;
    });
    const users = await this.resolveUsers(userIds);
    const tenants = await this.resolveTenants(
      targets
        .filter((target) => target.type === 'tenant' && target.id)
        .map((target) => target.id!),
    );

    return {
      data: rows.map((row, index) => {
        const target = targets[index]!;
        const actor = row.actor_id ? users.get(row.actor_id) : undefined;
        const subject = target.type === 'user' && target.id ? users.get(target.id) : undefined;

        let targetLabel: string | null = null;
        if (target.type === 'tenant' && target.id) {
          targetLabel = tenants.get(target.id) ?? null;
        } else if (subject) {
          targetLabel = subject.fullName ?? subject.phone;
        }

        return {
          id: row.id,
          actorId: row.actor_id,
          actorName: actor?.fullName ?? null,
          actorPhone: actor?.phone ?? null,
          action: row.action,
          targetType: target.type,
          targetId: target.id,
          targetLabel,
          reason: row.reason,
          createdAt: row.created_at,
        };
      }),
      total,
      page,
      totalPages,
    };
  }
}
