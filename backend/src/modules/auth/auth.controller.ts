import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { AcceptInviteDto, CreateInviteDto } from './dto/invite.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { InviteTokenService } from './invite-token.service';
import { OtpService } from './otp.service';
import { RefreshTokenService } from './refresh-token.service';
import type { AuthenticatedUser } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly inviteTokenService: InviteTokenService,
  ) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: SendOtpDto): Promise<{ message: string }> {
    await this.otpService.sendOtp(body.phoneNumber);
    return { message: 'کد تأیید ارسال شد.' };
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtpAndIssueToken(
      body.phoneNumber,
      body.code,
    );
  }

  /**
   * Public on purpose: the access token has already expired, which is the whole
   * reason the client is here. The refresh token in the body is the credential.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenDto) {
    return this.refreshTokenService.rotate(body.refreshToken);
  }

  /**
   * Also public: a client signing out may hold an expired access token, and
   * forcing it through the guard would leave the refresh token alive.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.refreshTokenService.revoke(body.refreshToken);
  }

  /** Revokes every session of the caller — "sign out everywhere". */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() request: Request): Promise<{ revoked: number }> {
    const user = request.user as AuthenticatedUser;
    const revoked = await this.refreshTokenService.revokeAll(user.userId);
    return { revoked };
  }

  // --- Invites (ADR-010) -------------------------------------------------
  // `tenantId` is always the caller's own, taken from the JWT: an invite grants
  // access to one salon, so accepting a tenant from the body would let any
  // signed-in user mint themselves an owner role in someone else's salon.

  @Roles('salon_owner', 'line_manager', 'admin')
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async createInvite(
    @Body() body: CreateInviteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    return this.inviteTokenService.create(body, user.userId, tenantId);
  }

  @Roles('salon_owner', 'line_manager', 'admin')
  @Get('invite/list')
  async listInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.inviteTokenService.listByTenant(this.requireTenant(user));
  }

  @Roles('salon_owner', 'line_manager', 'admin')
  @Delete('invite/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const revoked = await this.inviteTokenService.revoke(
      id,
      this.requireTenant(user),
      user.userId,
      user.role === 'admin',
    );
    if (!revoked) {
      // 404 rather than 403: "not yours" and "already used" must look the same
      // so the endpoint cannot be used to probe which invite ids exist.
      throw new NotFoundException('دعوت‌نامه یافت نشد');
    }
  }

  /**
   * Public: the invitee has no account yet, which is the whole point.
   *
   * The OTP is checked under the `invite` purpose, so a code sent for a normal
   * login cannot be spent here (and vice versa).
   */
  @Public()
  @Post('invite/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(@Body() body: AcceptInviteDto) {
    return this.authService.verifyInviteOtpAndIssueToken(body.token, body.phone, body.otpCode);
  }

  /** Guards the invite endpoints: staff without a salon have no tenant. */
  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('برای این عملیات باید به یک سالن وابسته باشید');
    }
    return user.tenantId;
  }
}
