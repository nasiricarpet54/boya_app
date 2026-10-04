import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import {
  APPROVAL_STATUSES,
  APPROVAL_TYPES,
  ApprovalStatus,
  ApprovalType,
} from '../../../common/approval-status';

// Re-exported so the controller can label the query parameters without having
// to know where the canonical list lives.
export { APPROVAL_STATUSES, APPROVAL_TYPES, ApprovalStatus, ApprovalType };

/** One row of the admin queue, normalised across the three tables. */
export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  /** `tenants` / `service_lines` have a display name, `specialists` does not. */
  name: string | null;
  tenantId: string | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date | null;
  /**
   * `tenants` only: the proposed values waiting for review. `service_lines`
   * and `specialists` have no such column, so this is always `null` for them.
   */
  pendingChanges: Record<string, unknown> | null;
}

export interface ApprovalPage {
  data: ApprovalItem[];
  total: number;
}

/**
 * Raw row of the three projections below. Every SELECT aliases its columns to
 * the same snake_case names so one mapper serves all three types; the optional
 * members are simply absent from the narrower projections.
 */
interface ApprovalRow {
  id: string;
  tenant_id?: string | null;
  name?: string | null;
  status: ApprovalStatus;
  rejection_reason: string | null;
  approved_at: Date | null;
  approved_by: string | null;
  created_at: Date | null;
  pending_changes?: Record<string, unknown> | null;
}

/**
 * Moderation queue behind /admin/approvals.
 *
 * Everything runs as raw SQL through the DataSource rather than through
 * TypeORM repositories, for two reasons:
 *
 *  1. The `Tenant` entity maps only seven columns (migrations 1730000000002 and
 *     1730000000009 added `cover_image_url` and `working_hours` to the table
 *     without touching the entity), so a repository-level save could neither
 *     read nor write the very fields this workflow merges. The same applies to
 *     `working_hours` in `staffTenant` (see SalonService).
 *  2. `tenants` and `specialists` carry no RLS, but `service_lines` is
 *     FORCE ROW LEVEL SECURITY, so that one type has to go through the
 *     SECURITY DEFINER functions added by migration 1730000000020.
 *
 * Every identifier used below is a literal from this file; the only
 * caller-supplied values (`status`, `id`, the admin id) are always bound.
 */
@Injectable()
export class ApprovalsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Admin-only guard, mirroring SalonService.requireStaffTenant. */
  private requireAdmin(user: AuthenticatedUser): void {
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('این بخش فقط برای مدیر سامان است');
    }
  }

  /** Rejects an unknown `:type` or `?status=` with a 400 before any SQL runs. */
  private static assertType(value: string | undefined): ApprovalType {
    if (!value || !APPROVAL_TYPES.includes(value as ApprovalType)) {
      throw new BadRequestException(
        `type باید یکی از ${APPROVAL_TYPES.join('، ')} باشد`,
      );
    }
    return value as ApprovalType;
  }

  private static assertStatus(value: string | undefined): ApprovalStatus {
    const status = value ?? 'pending_approval';
    if (!APPROVAL_STATUSES.includes(status as ApprovalStatus)) {
      throw new BadRequestException(
        `status باید یکی از ${APPROVAL_STATUSES.join('، ')} باشد`,
      );
    }
    return status as ApprovalStatus;
  }

  private static toItem(type: ApprovalType, row: ApprovalRow): ApprovalItem {
    return {
      id: row.id,
      type,
      status: row.status,
      name: row.name ?? null,
      tenantId: row.tenant_id ?? null,
      rejectionReason: row.rejection_reason,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      createdAt: row.created_at,
      pendingChanges: row.pending_changes ?? null,
    };
  }

  /**
   * GET /admin/approvals?type=&status=
   *
   * `type` is optional: omitting it returns the three queues concatenated, in
   * that order, so a moderation screen can show one combined inbox. `status`
   * defaults to `pending_approval` because that is the only queue an admin
   * normally works through.
   *
   * An empty result is a normal answer, not an error: before the first salon
   * requests anything the queue is legitimately empty.
   */
  async list(user: AuthenticatedUser, query: { type?: string; status?: string }): Promise<ApprovalPage> {
    this.requireAdmin(user);
    const status = ApprovalsService.assertStatus(query.status);
    const types = query.type
      ? [ApprovalsService.assertType(query.type)]
      : [...APPROVAL_TYPES];

    const rows: ApprovalItem[] = [];
    for (const type of types) {
      for (const row of await this.readQueue(type, status)) {
        rows.push(ApprovalsService.toItem(type, row));
      }
    }

    return { data: rows, total: rows.length };
  }

  /** GET /admin/approvals/:type/:id — the record as the admin sees it now. */
  async findOne(user: AuthenticatedUser, type: string, id: string): Promise<ApprovalItem> {
    this.requireAdmin(user);
    const target = ApprovalsService.assertType(type);

    const rows = await this.readOne(target, id);
    const row = rows[0];
    if (!row) throw new NotFoundException('درخواست یافت نشد');

    return ApprovalsService.toItem(target, row);
  }

  /**
   * POST /admin/approvals/:type/:id/approve
   *
   * For a tenant the stored `pending_changes` are merged into the live row in
   * the same statement, so there is no window in which the record is approved
   * but still shows the old name. Only the five fields the approval policy
   * gates are copied — see the column list in the SQL below. Nothing else in
   * `pending_changes` is ever written, so a hand-crafted key cannot reach an
   * unrelated column.
   *
   * For a service line or a specialist there is nothing to merge: neither
   * table has a `pending_changes` column (migration 1730000000018 adds it to
   * `tenants` only), so approving is the status flip on its own.
   */
  async approve(
    user: AuthenticatedUser,
    type: string,
    id: string,
  ): Promise<ApprovalItem> {
    this.requireAdmin(user);
    const target = ApprovalsService.assertType(type);

    if (target === 'service_line') {
      // RLS: the UPDATE has to run as the definer (migration 1730000000020).
      const applied = await this.dataSource.query<Array<{ applied: boolean }>>(
        `SELECT admin_apply_service_line_approval($1::uuid, 'approved', $2::uuid) AS applied`,
        [id, user.userId],
      );
      if (!applied[0]?.applied) throw new NotFoundException('درخواست یافت نشد');
    } else if (target === 'tenant') {
      await this.dataSource.query(
        `UPDATE tenants t
            SET name = COALESCE(t.pending_changes ->> 'name', t.name),
                address = COALESCE(t.pending_changes ->> 'address', t.address),
                phone = COALESCE(t.pending_changes ->> 'phone', t.phone),
                cover_image_url = COALESCE(t.pending_changes ->> 'coverImage', t.cover_image_url),
                working_hours = COALESCE(t.pending_changes -> 'workingHours', t.working_hours),
                status = 'approved',
                rejection_reason = NULL,
                pending_changes = NULL,
                approved_at = NOW(),
                approved_by = $2
          WHERE t.id = $1`,
        [id, user.userId],
      );
    } else {
      await this.dataSource.query(
        `UPDATE specialists
            SET status = 'approved',
                rejection_reason = NULL,
                approved_at = NOW(),
                approved_by = $2
          WHERE id = $1`,
        [id, user.userId],
      );
    }

    return this.findOne(user, target, id);
  }

  /**
   * POST /admin/approvals/:type/:id/reject
   *
   * `pending_changes` is dropped, so a rejected edit is not silently carried
   * over into the next request: the salon has to send the values again. The
   * reason is stored verbatim for the salon to read back on
   * GET /salon/me/status.
   */
  async reject(
    user: AuthenticatedUser,
    type: string,
    id: string,
    reason: string,
  ): Promise<ApprovalItem> {
    this.requireAdmin(user);
    const target = ApprovalsService.assertType(type);

    if (target === 'service_line') {
      const applied = await this.dataSource.query<Array<{ applied: boolean }>>(
        `SELECT admin_apply_service_line_approval($1::uuid, 'rejected', NULL, $2::text) AS applied`,
        [id, reason],
      );
      if (!applied[0]?.applied) throw new NotFoundException('درخواست یافت نشد');
    } else if (target === 'tenant') {
      // Only $1 and $2 are bound: the admin id is not a parameter here. (An
      // unreferenced $n would make PostgreSQL fail the Parse step with "could
      // not determine data type".)
      //
      // approved_at / approved_by are deliberately left untouched: rejecting a
      // *change* says nothing about whether the salon itself was ever
      // approved, and the public feed keys off exactly that. Clearing them
      // would un-publish a salon that had been serving customers all along.
      await this.dataSource.query(
        `UPDATE tenants
            SET status = 'rejected',
                rejection_reason = $2,
                pending_changes = NULL
          WHERE id = $1`,
        [id, reason],
      );
    } else {
      await this.dataSource.query(
        `UPDATE specialists
            SET status = 'rejected',
                rejection_reason = $2
          WHERE id = $1`,
        [id, reason],
      );
    }

    return this.findOne(user, target, id);
  }

  /**
   * The rows of one type's queue, oldest first.
   *
   * `tenants` and `specialists` have no RLS, so they are plain SELECTs.
   * `service_lines` is FORCE ROW LEVEL SECURITY on a tenant setting an admin
   * request does not carry, so it goes through the SECURITY DEFINER function
   * from migration 1730000000020; a plain SELECT there would return zero rows
   * and the queue would look permanently empty.
   */
  private async readQueue(type: ApprovalType, status: ApprovalStatus): Promise<ApprovalRow[]> {
    if (type === 'service_line') {
      return this.dataSource.query<ApprovalRow[]>(
        `SELECT * FROM admin_list_service_line_approvals($1::approval_status)`,
        [status],
      );
    }

    if (type === 'tenant') {
      return this.dataSource.query<ApprovalRow[]>(
        `SELECT t.id,
                t.name,
                t.status,
                t.rejection_reason,
                t.approved_at,
                t.approved_by,
                t.pending_changes,
                t.created_at
           FROM tenants t
          WHERE t.status = $1::approval_status
          ORDER BY t.created_at ASC, t.id ASC`,
        [status],
      );
    }

    return this.dataSource.query<ApprovalRow[]>(
      `SELECT s.id,
              s.tenant_id,
              s.status,
              s.rejection_reason,
              s.approved_at,
              s.approved_by,
              s.created_at
         FROM specialists s
        WHERE s.status = $1::approval_status
        ORDER BY s.created_at ASC, s.id ASC`,
      [status],
    );
  }

  /** One row by id. Same RLS split as `readQueue`. */
  private async readOne(type: ApprovalType, id: string): Promise<ApprovalRow[]> {
    if (type === 'service_line') {
      return this.dataSource.query<ApprovalRow[]>(
        `SELECT * FROM admin_get_service_line_approval($1::uuid)`,
        [id],
      );
    }

    if (type === 'tenant') {
      return this.dataSource.query<ApprovalRow[]>(
        `SELECT t.id,
                t.name,
                t.address,
                t.phone,
                t.cover_image_url,
                t.working_hours,
                t.status,
                t.rejection_reason,
                t.approved_at,
                t.approved_by,
                t.pending_changes,
                t.created_at
           FROM tenants t
          WHERE t.id = $1::uuid`,
        [id],
      );
    }

    return this.dataSource.query<ApprovalRow[]>(
      `SELECT s.id,
              s.tenant_id,
              s.user_id,
              s.bio,
              s.status,
              s.rejection_reason,
              s.approved_at,
              s.approved_by,
              s.created_at
         FROM specialists s
        WHERE s.id = $1::uuid`,
      [id],
    );
  }
}