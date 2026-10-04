import { createHash, randomInt, timingSafeEqual } from 'crypto';

import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '@mirad-work/sms-nestjs';
import Redis from 'ioredis';

import { toLatinDigits } from '../../utils/persian-number.util';
import { PERSIAN_ERRORS } from '../../common/persian-errors';

const OTP_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 600;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    @Inject('OTP_REDIS') private readonly redis: Redis,
    private readonly smsService: SmsService,
    private readonly config: ConfigService,
  ) {}

  async sendOtp(phoneNumber: string): Promise<void> {
    const phone = this.normalizePersianPhone(phoneNumber);
    const attempts = await this.redis.incr(this.rateKey(phone));
    if (attempts === 1) {
      await this.redis.expire(this.rateKey(phone), RATE_WINDOW_SECONDS);
    }
    if (attempts > MAX_SENDS_PER_WINDOW) {
      throw new HttpException(
        PERSIAN_ERRORS.OTP_RATE_LIMIT,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(100000, 1000000).toString();
    await this.redis.set(this.otpKey(phone), this.hash(phone, code), 'EX', OTP_TTL_SECONDS);
    await this.redis.del(this.attemptKey(phone));

    const apiKey = process.env.KAVENEGAR_API_KEY;
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const isDevMode = !apiKey || nodeEnv !== 'production';

    if (isDevMode) {
      // eslint-disable-next-line no-console
      console.log(
        `\n===== [DEV MODE] OTP for ${phone}: ${code} =====\n`,
      );
      return;
    }

    const sent = await this.smsService.verify({
      to: phone,
      template: this.config.get<string>('KAVENEGAR_OTP_TEMPLATE', 'boya-otp'),
      tokens: { code },
    });
    if (!sent.success) {
      await this.redis.del(this.otpKey(phone));
      throw new HttpException(PERSIAN_ERRORS.SMS_FAILED, HttpStatus.BAD_GATEWAY);
    }
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<void> {
    const phone = this.normalizePersianPhone(phoneNumber);
    const stored = await this.redis.get(this.otpKey(phone));
    if (!stored) {
      throw new UnauthorizedException(PERSIAN_ERRORS.OTP_EXPIRED);
    }

    const tries = await this.redis.incr(this.attemptKey(phone));
    if (tries === 1) {
      await this.redis.expire(this.attemptKey(phone), OTP_TTL_SECONDS);
    }
    if (tries > MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(this.otpKey(phone));
      throw new HttpException(
        PERSIAN_ERRORS.OTP_TOO_MANY_ATTEMPTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const latinCode = toLatinDigits(code);
    if (!this.sameHash(stored, this.hash(phone, latinCode))) {
      throw new UnauthorizedException(PERSIAN_ERRORS.OTP_INVALID);
    }
    await this.redis.del(this.otpKey(phone), this.attemptKey(phone));
  }

  normalizePersianPhone(phone: string): string {
    let normalized = toLatinDigits(phone).split(' ').join('').split('-').join('');
    if (normalized.startsWith('+98')) {
      normalized = `0${normalized.slice(3)}`;
    } else if (normalized.startsWith('98')) {
      normalized = `0${normalized.slice(2)}`;
    }
    if (!/^09[0-9]{9}$/.test(normalized)) {
      throw new HttpException(PERSIAN_ERRORS.INVALID_PHONE, HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private hash(phone: string, code: string): string {
    return createHash('sha256')
      .update(`${this.config.getOrThrow<string>('OTP_PEPPER')}:${phone}:${code}`)
      .digest('hex');
  }

  private sameHash(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private otpKey(phone: string): string {
    return `otp:${phone}`;
  }

  private rateKey(phone: string): string {
    return `otp:rate:${phone}`;
  }

  private attemptKey(phone: string): string {
    return `otp:tries:${phone}`;
  }
}
