import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
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
}
