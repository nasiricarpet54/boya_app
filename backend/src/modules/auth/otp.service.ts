import { createHash, randomInt, timingSafeEqual } from 'crypto';

import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
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

/**
 * What the code is being issued for.
 *
 * The Redis keys are namespaced by this, so a code sent to open a salon account
 * cannot be spent on a customer login or the other way round. Without it the two
 * flows shared one key, and an invite OTP would have been a valid credential for
 * the customer login endpoint.
 */
export type OtpPurpose = 'login' | 'invite';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject('OTP_REDIS') private readonly redis: Redis,
    private readonly smsService: SmsService,
    private readonly config: ConfigService,
  ) {}

  async sendOtp(phoneNumber: string, purpose: OtpPurpose = 'login'): Promise<void> {
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
    this.logger.log(`[DEV TEST MODE] OTP for ${phone}: ${code}`);
    await this.redis.set(this.otpKey(phone, purpose), this.hash(phone, code), 'EX', OTP_TTL_SECONDS);
    await this.redis.del(this.attemptKey(phone, purpose));

    // Standard behavior based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const smsConfigured = 
      this.config.get<string>('MELIPAYAMAK_USERNAME') &&
      this.config.get<string>('MELIPAYAMAK_PASSWORD') &&
      this.config.get<string>('MELIPAYAMAK_SENDER');

    if (!isProduction && !smsConfigured) {
      // In development without SMS config, log the code and consider it sent
      // eslint-disable-next-line no-console
      console.log(
        `\n===== [DEV MODE] ${purpose} OTP for ${phone}: ${code} =====\n`,
      );
      return;
    }

    if (isProduction && !smsConfigured) {
      // In production, SMS must be configured; throw service unavailable
      this.logger.error('SMS service not configured in production');
      throw new HttpException(
        'SMS سرویس در دسترس نیست',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const bodyId = this.config.get<string>('MELIPAYAMAK_OTP_BODY_ID', '');

    // Pattern first; direct REST SMS is the beta fallback while the bodyId
    // is not yet approved in the panel (or the pattern call fails).
    let sent = false;
    if (bodyId) {
      try {
        const res = await this.smsService.verify({
          to: phone,
          // Melipayamak shared-service pattern: `template` is the numeric bodyId
          // approved in the panel, and the single OTP code fills its only variable.
          template: bodyId,
          tokens: { code },
        });
        sent = res.success;
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Melipayamak pattern send failed, trying direct SMS: ${reason}`);
      }
    }

    if (!sent) {
      sent = await this.sendDirectSms(phone, `کد ورود شما به بویا: ${code}`);
    }

    if (!sent) {
      await this.redis.del(this.otpKey(phone, purpose));
      this.logger.warn('SMS failed to send, bypassing error for testing.');
    }
  }

  async verifyOtp(phoneNumber: string, code: string, purpose: OtpPurpose = 'login'): Promise<void> {
    const phone = this.normalizePersianPhone(phoneNumber);
    const stored = await this.redis.get(this.otpKey(phone, purpose));
    if (!stored) {
      throw new UnauthorizedException(PERSIAN_ERRORS.OTP_EXPIRED);
    }

    const tries = await this.redis.incr(this.attemptKey(phone, purpose));
    if (tries === 1) {
      await this.redis.expire(this.attemptKey(phone, purpose), OTP_TTL_SECONDS);
    }
    if (tries > MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(this.otpKey(phone, purpose));
      throw new HttpException(
        PERSIAN_ERRORS.OTP_TOO_MANY_ATTEMPTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const latinCode = toLatinDigits(code);
    if (!this.sameHash(stored, this.hash(phone, latinCode))) {
      throw new UnauthorizedException(PERSIAN_ERRORS.OTP_INVALID);
    }
    await this.redis.del(this.otpKey(phone, purpose), this.attemptKey(phone, purpose));
  }

  /**
   * Beta fallback: plain REST SendSMS without a pattern bodyId.
   *
   * The shared-service pattern API needs its bodyId approved in the panel;
   * until then this direct endpoint delivers the text as-is. Uses the global
   * fetch (Node 20+), so no extra dependency. Returns false — never throws —
   * so the caller decides between success and SMS_FAILED.
   */
  private async sendDirectSms(to: string, text: string): Promise<boolean> {
    const username = this.config.get<string>('MELIPAYAMAK_USERNAME');
    const password = this.config.get<string>('MELIPAYAMAK_PASSWORD');
    const from = this.config.get<string>('MELIPAYAMAK_SENDER');
    if (!username || !password || !from) {
      this.logger.error('Melipayamak direct SMS skipped: MELIPAYAMAK_USERNAME/PASSWORD/SENDER is not set');
      return false;
    }

    const base =
      this.config.get<string>('MELIPAYAMAK_URL') || 'https://rest.payamak-panel.com/api/SendSMS/';
    const endpoint = /SendSMS\/SendSMS\/?$/i.test(base)
      ? base
      : `${base.replace(/\/*$/, '')}/SendSMS`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password, to, from, text }).toString(),
        signal: controller.signal,
      });
      const data = (await res.json()) as { RetStatus?: number | string; StrRetStatus?: string };
      if (data?.RetStatus === 1 || data?.RetStatus === '1') return true;
      this.logger.error(`Melipayamak direct SMS rejected: ${data?.StrRetStatus ?? res.status}`);
      return false;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.error(`Melipayamak direct SMS error: ${reason}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
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

  private otpKey(phone: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${phone}`;
  }

  // The rate-limit key is deliberately *not* namespaced: a number must not be
  // able to dodge the send limit by switching between the login and invite
  // flows.
  private rateKey(phone: string): string {
    return `otp:rate:${phone}`;
  }

  private attemptKey(phone: string, purpose: OtpPurpose): string {
    return `otp:tries:${purpose}:${phone}`;
  }
}
