import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { ADMIN_ROLES } from '../user/entities/user.entity';

/** The platform back-office: admin and super_admin only. */
@Roles(...ADMIN_ROLES)
@ApiTags('admin')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('admin')
export class AdminController {}
