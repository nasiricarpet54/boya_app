import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '@mirad-work/sms-nestjs';

/** Booking alerts use a lookup template, never the OTP template. */
@Injectable()
export class KavenegarAlertService {
  private readonly logger = new Logger(KavenegarAlertService.name);

  constructor(
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  async sendBookingAlert(phone: string, token: string): Promise<boolean> {
    const template = this.config.get<string>('KAVENEGAR_BOOKING_TEMPLATE');
    if (!template) {
      this.logger.warn('KAVENEGAR_BOOKING_TEMPLATE is unset; SMS alert skipped');
      return false;
    }
    const sent = await this.sms.verify({ to: phone, template, tokens: { token } });
    if (!sent.success) this.logger.warn('Kavenegar booking alert was not accepted');
    return sent.success;
  }
}
