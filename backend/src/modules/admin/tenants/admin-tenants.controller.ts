import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { AdminTenantsService, TenantDetail, TenantListPage } from './admin-tenants.service';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

/** Admin tenants management. Global JwtAuthGuard rejects anonymous; service enforces role=admin. */
@ApiTags('admin/tenants')
@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly tenants: AdminTenantsService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست سالن‌ها', description: 'جستجو در نام/slug/تلفن، فیلتر وضعیت، مرتب newest-first.' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTenantsQueryDto): Promise<TenantListPage> {
    return this.tenants.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات سالن', description: 'تمام فیلدها + آمار + ۱۰ رزرو اخیر.' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<TenantDetail> {
    return this.tenants.findOne(user, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'تغییر وضعیت سالن', description: 'approved (تایید/فعال‌سازی مجدد) یا suspended (تعلیق) + ثبت در audit_logs.' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
  ): Promise<TenantDetail> {
    return this.tenants.updateStatus(user, id, dto.status, dto.reason);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش سالن', description: 'ویرایش فیلدهای عمومی (نام، اسلاگ، آدرس، تلفن، دسته، تخفیف، ویژه) + ثبت در audit_logs.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantDetail> {
    return this.tenants.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'غیرفعال‌سازی سالن', description: 'soft delete: is_active=false و status=suspended + ثبت در audit_logs.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; message: string }> {
    return this.tenants.softDelete(user, id);
  }
}
