import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { CreateSpecialistDto } from './dto/create-specialist.dto';
import { UpdateSpecialistDto } from './dto/update-specialist.dto';
import { Specialist } from './entities/specialist.entity';
import { SpecialistService } from './specialist.service';

@ApiTags('specialists')
@ApiBearerAuth()
@Roles('admin', 'salon_owner', 'line_manager')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('specialists')
export class SpecialistController {
  constructor(private readonly specialistService: SpecialistService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست متخصصان سالن' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'شناسه سالن (برای نقش ادمین)' })
  @ApiResponse({ status: 200, description: 'لیست متخصصین' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tenantId') queryTenantId?: string,
  ): Promise<Specialist[]> {
    const tenantId = user.tenantId || queryTenantId;
    if (!tenantId) {
      throw new BadRequestException('شناسه سالن مشخص نشده است');
    }
    return this.specialistService.findAll(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ثبت متخصص جدید در سالن' })
  @ApiResponse({ status: 201, description: 'متخصص با موفقیت ثبت شد' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSpecialistDto,
  ): Promise<Specialist> {
    const tenantId = user.tenantId || dto.tenantId;
    if (!tenantId) {
      throw new BadRequestException('شناسه سالن مشخص نشده است');
    }
    return this.specialistService.create({
      tenantId,
      userId: dto.userId,
      bio: dto.bio,
      skills: dto.skills,
      commissionRate: dto.commissionRate,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'دریافت اطلاعات متخصص' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'شناسه سالن (برای نقش ادمین)' })
  @ApiResponse({ status: 200, description: 'اطلاعات متخصص' })
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('tenantId') queryTenantId?: string,
  ): Promise<Specialist> {
    const tenantId = user.tenantId || queryTenantId;
    if (!tenantId) {
      throw new BadRequestException('شناسه سالن مشخص نشده است');
    }
    return this.specialistService.findById(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش متخصص (شامل غیرفعالسازی نرم)' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'شناسه سالن (برای نقش ادمین)' })
  @ApiResponse({ status: 200, description: 'اطلاعات متخصص ویرایش شد' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSpecialistDto,
    @Query('tenantId') queryTenantId?: string,
  ): Promise<Specialist> {
    const tenantId = user.tenantId || queryTenantId;
    if (!tenantId) {
      throw new BadRequestException('شناسه سالن مشخص نشده است');
    }
    return this.specialistService.update(tenantId, id, {
      bio: dto.bio,
      skills: dto.skills,
      commissionRate: dto.commissionRate,
      isActive: dto.isActive,
      offersMobileService: dto.offersMobileService,
    });
  }
}