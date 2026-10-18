import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { UseGuards, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';

@ApiTags('tenants')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * Creates a salon (ADR-010 onboarding step 1).
   *
   * Admin-only: a salon is a billing and RLS boundary, so only the platform
   * operator may bring one into existence. The invited owner never reaches this
   * route — they join an existing tenant by redeeming an invite.
   *
   * `JwtAuthGuard` and `RolesGuard` are global (`app.module.ts`), so no
   * `@UseGuards` is needed; `@Roles('admin')` is enough and is required by
   * `.cursorrules` for every route.
   */
  @Roles('admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateTenantDto): Promise<Tenant> {
    return this.tenantService.create(body);
  }
}
