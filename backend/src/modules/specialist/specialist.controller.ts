import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('specialists')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('specialists')
export class SpecialistController {}
