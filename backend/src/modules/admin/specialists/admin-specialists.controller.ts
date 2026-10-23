import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../../auth/guards/tenant-hierarchy.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { AdminUsersService } from '../users/admin-users.service';
import { ListUsersQueryDto } from '../users/dto/list-users-query.dto';
import { AdminUserListPage } from '../users/admin-users.service';

/** Admin specialists management. Global JwtAuthGuard rejects anonymous; service enforces role=admin. */
@ApiTags('admin/specialists')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('admin/specialists')
export class AdminSpecialistsController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('mobile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'فهرست متخصصان سیار',
    description: 'دریافت لیست کلیه متخصصان سیار (نقش freelance_mobile) در سراسر پلتفرم. مرتب createdAt DESC.',
  })
  getMobileSpecialists(@CurrentUser() user: AuthenticatedUser): Promise<AdminUserListPage> {
    return this.users.list(user, { role: 'freelance_mobile' } as ListUsersQueryDto);
  }
}
