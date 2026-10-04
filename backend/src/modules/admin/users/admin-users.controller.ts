import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import {
  AdminUserDetail,
  AdminUsersService,
  ADMIN_USER_ROLES,
  AdminUserListPage,
  UserUpdateResult,
} from './admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

/** Admin users management. Global JwtAuthGuard rejects anonymous; service enforces role=admin. */
@ApiTags('admin/users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'فهرست کاربران',
    description: 'جستجو در نام/تلفن، فیلتر نقش و وضعیت، مرتب createdAt DESC؛ به همراه شمارش هر نقش.',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUsersQueryDto): Promise<AdminUserListPage> {
    return this.users.list(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'جزئیات کاربر',
    description: 'پروفایل کامل + تعداد رزرو + ۵ رزرو اخیر + ۵ اقدام اخیر audit_logs.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserDetail> {
    return this.users.findOne(user, id);
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'تغییر نقش کاربر',
    description:
      `نقش‌های salon_owner/line_manager/specialist نیازمند tenantId؛ ` +
      `customer/admin آن را پاک می‌کنند. تغییر نقش خود و حذف آخرین ادمین مجاز نیست. ` +
      `ثبت در audit_logs. نقش‌ها: ${ADMIN_USER_ROLES.join(', ')}.`,
  })
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserUpdateResult> {
    return this.users.updateRole(user, id, dto.role, dto.tenantId);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'فعال/غیرفعال‌سازی کاربر',
    description: 'تغییر وضعیت خود مجاز نیست؛ تغییر در audit_logs ثبت می‌شود.',
  })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserUpdateResult> {
    return this.users.updateStatus(user, id, dto.isActive, dto.reason);
  }
}
