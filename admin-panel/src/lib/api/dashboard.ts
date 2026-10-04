import api from './client';

/**
 * Admin dashboard figures — mirrors `DashboardService.AdminDashboard`.
 * `totalRevenue` is always 0 in Phase 1: no money flows through the platform.
 */
export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  pendingApprovals: number;
  totalBookings: number;
  todayBookings: number;
  totalRevenue: number;
}

/** One column of the weekly chart, oldest day first. `day` is the Persian weekday name. */
export interface WeeklyBooking {
  day: string;
  count: number;
}

export interface AdminDashboardPayload {
  stats: DashboardStats;
  weeklyBookings: WeeklyBooking[];
}

export const dashboardApi = {
  /** `GET /admin/dashboard` — headline figures plus the 7-day booking series. */
  getDashboard(): Promise<AdminDashboardPayload> {
    return api.get<AdminDashboardPayload>('/admin/dashboard').then((r) => r.data);
  },
};
