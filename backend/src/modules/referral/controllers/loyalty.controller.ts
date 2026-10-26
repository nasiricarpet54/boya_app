import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { LoyaltyPointService } from '../services/loyalty-point.service';

/** Read-only while redemption has no booking integration yet. */
@Roles('customer')
@ApiTags('loyalty')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyPointService) {}

  @Get('balance')
  @ApiOperation({ summary: 'موجودی امتیاز کاربر' })
  async balance(@CurrentUser() user: AuthenticatedUser) {
    return { points: await this.loyalty.getBalance(user.userId) };
  }

  @Get('history')
  @ApiOperation({ summary: 'تاریخچه امتیازات' })
  @ApiQuery({ name: 'limit', required: false })
  async history(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit = '50') {
    const parsed = Number.parseInt(limit, 10);
    const take = Number.isNaN(parsed) || parsed <= 0 ? 50 : Math.min(parsed, 200);
    return { data: await this.loyalty.getHistory(user.userId, take) };
  }
}
