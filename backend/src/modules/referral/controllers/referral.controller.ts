import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { ApplyReferralDto } from '../dto/apply-referral.dto';
import { ReferralService } from '../services/referral.service';

/** The acting user is always the verified token, never a query parameter. */
@ApiTags('referrals')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('referrals')
export class ReferralController {
  constructor(private readonly referrals: ReferralService) {}

  @Get('my-code')
  @ApiOperation({ summary: 'دریافت کد معرف کاربر جاری' })
  async myCode(@CurrentUser() user: AuthenticatedUser) {
    return { code: await this.referrals.getOrCreateCode(user.userId) };
  }

  @Post('apply')
  @ApiOperation({ summary: 'اعمال کد معرف کاربر تازه‌وارد' })
  async apply(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplyReferralDto) {
    const referral = await this.referrals.applyCode(user.userId, dto.code);
    return {
      success: true,
      message: 'کد معرف با موفقیت اعمال شد',
      referralId: referral.id,
      referrerId: referral.referrerId,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'آمار معرفی‌های کاربر' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getStats(user.userId);
  }

  @Get('referred-users')
  @ApiOperation({ summary: 'لیست کاربران معرفی‌شده' })
  async referredUsers(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.referrals.getReferredUsers(user.userId) };
  }
}
