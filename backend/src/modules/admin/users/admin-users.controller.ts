import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../../auth/guards/tenant-hierarchy.guard';
import { UseGuards,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import {
  AdminUserDetail,
  AdminUsersService,
  ADMIN_USER_ROLES,
  AdminUserListPage,
  UserCreateResult,
  UserUpdateResult,
} from './admin-users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

/** Admin users management. Global JwtAuthGuard rejects anonymous; service enforces role=admin. */
@ApiTags('admin/users')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'ساخت کاربر',
    description:
      `شماره تکراری → 409. برای نقش specialist همراه tenantId، ردیف متخصص هم ساخته می‌شود. ` +
      `ثبت در audit_logs. نقش‌ها: ${ADMIN_USER_ROLES.join(', ')}.`,
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserCreateResult> {
    return this.users.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'فهرست کاربران',
    description: 'جستجو در نام/تلفن، فیلتر نقش و وضعیت، مرتب createdAt DESC؛ به همراه شمارش هر نقش.',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUsersQueryDto): Promise<AdminUserListPage> {
    return this.users.list(user, query);
  }

  @Get('mobile')
  @ApiOperation({
    summary: 'فهرست متخصصان سیار',
    description: 'دریافت لیست کلیه متخصصان سیار (نقش freelance_mobile) در سراسر پلتفرم. مرتب createdAt DESC.',
  })
  getMobileSpecialists(@CurrentUser() user: AuthenticatedUser): Promise<AdminUserListPage> {
    return this.users.list(user, { role: 'freelance_mobile' } as ListUsersQueryDto);
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

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش نام کاربر', description: 'ویرایش full_name؛ نقش/وضعیت/tenant endpoint جداگانه دارند. ثبت در audit_logs.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<AdminUserDetail> {
    return this.users.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'حذف نرم کاربر',
    description:
      'is_active=false روی کاربر و (اگر متخصص باشد) ردیف متخصص. حذف حساب خود → 400. ثبت در audit_logs.',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true }> {
    return this.users.softDelete(user, id);
  }
}
