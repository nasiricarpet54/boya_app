import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';

/** Headline figures of `GET /admin/dashboard`. */
export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  pendingApprovals: number;
  totalBookings: number;
  todayBookings: number;
  /** Phase 1 takes no money through the platform (see PROJECT_CHARTER.md). */
  totalRevenue: number;
}

/** One column of the weekly chart, oldest day first. */
export interface WeeklyBooking {
  day: string;
  count: number;
}

export interface AdminDashboard {
  stats: DashboardStats;
  weeklyBookings: WeeklyBooking[];
}

/** Raw `admin_dashboard_counts()` row. `pg` returns BIGINT as text. */
interface DashboardCountsRow {
  total_tenants: string | number;
  active_tenants: string | number;
  pending_approvals: string | number;
  total_bookings: string | number;
  today_bookings: string | number;
}

/** Raw `admin_dashboard_weekly()` row. */
interface DashboardWeeklyRow {
  day: string;
  bookings: string | number;
}

/**
 * Figures behind GET /admin/dashboard.
 *
 * Raw SQL through the DataSource, not TypeORM repositories — the counts span
 * `bookings` and `service_lines`, both FORCE ROW LEVEL SECURITY on a tenant
 * setting an admin request does not carry. The aggregation itself lives in
 * the SECURITY DEFINER functions from migration 1730000000022, so these
 * queries only read two narrow, admin-only functions.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  /** Admin-only guard, mirroring ApprovalsService.requireAdmin. */
  private requireAdmin(user: AuthenticatedUser): void {
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('این بخش فقط برای مدیر سامانه است');
    }
  }

  async getDashboard(user: AuthenticatedUser): Promise<AdminDashboard> {
    this.requireAdmin(user);

    const [countsRow] = await this.dataSource.query<DashboardCountsRow[]>(`
      SELECT * FROM admin_dashboard_counts()
    `);
    const weeklyRows = await this.dataSource.query<DashboardWeeklyRow[]>(`
      SELECT * FROM admin_dashboard_weekly()
    `);

    return {
      stats: {
        totalTenants: Number(countsRow?.total_tenants ?? 0),
        activeTenants: Number(countsRow?.active_tenants ?? 0),
        pendingApprovals: Number(countsRow?.pending_approvals ?? 0),
        totalBookings: Number(countsRow?.total_bookings ?? 0),
        todayBookings: Number(countsRow?.today_bookings ?? 0),
        totalRevenue: 0,
      },
      weeklyBookings: weeklyRows.map((row) => ({
        day: row.day,
        count: Number(row.bookings ?? 0),
      })),
    };
  }
}
