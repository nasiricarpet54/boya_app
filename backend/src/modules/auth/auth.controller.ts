import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { OtpService } from './otp.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
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
}
