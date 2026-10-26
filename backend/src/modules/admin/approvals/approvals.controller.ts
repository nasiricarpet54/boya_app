import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ADMIN_ROLES } from '../../user/entities/user.entity';
import { TenantHierarchyGuard } from '../../auth/guards/tenant-hierarchy.guard';
import { UseGuards,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { RejectApprovalDto } from './dto/reject-approval.dto';
import {
  APPROVAL_STATUSES,
  APPROVAL_TYPES,
  ApprovalItem,
  ApprovalPage,
  ApprovalsService,
} from './approvals.service';

/**
 * Admin approval queue.
 *
 * Not marked `@Public`, so the global JwtAuthGuard (registered as an APP_GUARD
 * in app.module.ts) already rejects an unauthenticated call. The `role=admin`
 * half of the rule is enforced in `ApprovalsService.requireAdmin`, the same
 * place `SalonService.requireStaffTenant` checks the staff roles — a service
 * that reads and writes three tables is the right place for it, and it means a
 * future caller of the service cannot skip the check.
 */
@ApiTags('admin/approvals')
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('admin/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @ApiOperation({
    summary: 'صف تایید تغییرات',
    description:
      'صف تایید ادمین. type و status اختیاری‌اند؛ type نامشخص همه صف‌ها را ' +
      'با هم برمی‌گرداند و status پیش‌فرض pending_approval است.',
  })
  @ApiQuery({ name: 'type', enum: APPROVAL_TYPES, required: false })
  @ApiQuery({ name: 'status', enum: APPROVAL_STATUSES, required: false })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ): Promise<ApprovalPage> {
    return this.approvals.list(user, { type, status });
  }

  @Get(':type/:id')
  @ApiOperation({
    summary: 'جزئیات یک درخواست تایید',
    description: 'آخرین وضعیت رکورد به همراه pending_changes در صورت وجود.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApprovalItem> {
    return this.approvals.findOne(user, type, id);
  }

  @Post(':type/:id/approve')
  // 200, not Nest's 201 default: this is a state transition on a record that
  // already exists, exactly like BookingController's ':id/approve'.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'تایید درخواست',
    description:
      'در صورت وجود pending_changes مقادیر جدید در همان رکورد اصلی merge می‌شوند.',
  })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApprovalItem> {
    return this.approvals.approve(user, type, id);
  }

  @Post(':type/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'رد درخواست',
    description: 'دلیل رد ذخیره می‌شود و pending_changes پاک می‌شود.',
  })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectApprovalDto,
  ): Promise<ApprovalItem> {
    return this.approvals.reject(user, type, id, dto.reason);
  }
}
