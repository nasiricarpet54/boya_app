import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { AdminDashboard, DashboardService } from './dashboard.service';

/**
 * Admin dashboard figures.
 *
 * Not marked `@Public`, so the global JwtAuthGuard (registered as an APP_GUARD
 * in app.module.ts) already rejects an unauthenticated call. The `role=admin`
 * half of the rule is enforced in `DashboardService.requireAdmin`, the same
 * place `ApprovalsService.requireAdmin` checks it — a service that aggregates
 * every tenant is the right place for it, and it means a future caller of the
 * service cannot skip the check.
 */
@ApiTags('admin/dashboard')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'نمای کلی داشبورد ادمین',
    description:
      'آمار سامانه و رزروهای ۷ روز گذشته. فقط نقش admin. درآمد در فاز ۱ ' +
      'همیشه صفر است چون پرداختی از سامانه عبور نمی‌کند.',
  })
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminDashboard> {
    return this.dashboard.getDashboard(user);
  }
}
