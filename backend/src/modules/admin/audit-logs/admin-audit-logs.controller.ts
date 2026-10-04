import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { AdminAuditLogsService, AuditLogListPage } from './admin-audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/** Admin audit trail. Global JwtAuthGuard rejects anonymous; service enforces role=admin. */
@ApiTags('admin/audit-logs')
@Controller('admin/audit-logs')
export class AdminAuditLogsController {
  constructor(private readonly auditLogs: AdminAuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'فهرست لاگ اقدامات',
    description:
      `فیلتر با actorId، پیشوند action (مثل tenant.) و targetType؛ ` +
      `هر ردیف شامل actor، action، هدف و توضیح. مرتب‌سازی createdAt DESC.`,
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<AuditLogListPage> {
    return this.auditLogs.list(user, query);
  }
}
