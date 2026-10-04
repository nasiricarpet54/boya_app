import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';

import { SMS_SENDER, SmsSender } from './interfaces/sms-sender.interface';
import { OTP_STORAGE, OtpStorage } from './storage/otp-storage.interface';

const OTP_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 600;
const MAX_SENDS = 3;

@Injectable()
export class MemoryOtpService {
  constructor(
    @Inject(OTP_STORAGE) private readonly storage: OtpStorage,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async sendOtp(phone: string): Promise<{ success: true; message: string }> {
    const attempts = await this.storage.incrementRateLimit(phone, RATE_WINDOW_SECONDS);
    if (attempts > MAX_SENDS) {
      throw new HttpException(
        'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً ۱۰ دقیقه دیگر تلاش کنید.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = randomInt(100000, 1000000).toString();
    await this.storage.set(phone, code, OTP_TTL_SECONDS);
    try {
      await this.sms.sendOtp(phone, code);
    } catch {
      throw new BadRequestException('ارسال پیامک با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
    }
    return { success: true, message: 'کد تایید ارسال شد' };
  }

  async verifyOtp(phone: string, code: string): Promise<{ valid: true }> {
    if (!/^[0-9]{6}$/.test(code)) {
      throw new BadRequestException('کد وارد شده باید ۶ رقم باشد');
    }
    const stored = await this.storage.get(phone);
    if (!stored) {
      throw new BadRequestException('کد تایید منقضی شده است. لطفاً کد جدید دریافت کنید');
    }
    if (stored !== code) {
      throw new BadRequestException('کد وارد شده صحیح نیست');
    }
    await this.storage.delete(phone);
    return { valid: true };
  }
}
