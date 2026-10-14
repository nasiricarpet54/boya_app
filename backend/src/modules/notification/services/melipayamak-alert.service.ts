import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '@mirad-work/sms-nestjs';

/**
 * Booking alerts over Melipayamak (ملی پیامک) shared-service patterns.
 *
 * Uses a lookup pattern (bodyId), never the OTP pattern: `template` is the
 * numeric bodyId approved in the panel and the single token fills its variable.
 */
@Injectable()
export class MelipayamakAlertService {
  private readonly logger = new Logger(MelipayamakAlertService.name);

  constructor(
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  async sendBookingAlert(phone: string, token: string): Promise<boolean> {
    const bodyId = this.config.get<string>('MELIPAYAMAK_BOOKING_BODY_ID');
    if (!bodyId) {
      this.logger.warn('MELIPAYAMAK_BOOKING_BODY_ID is unset; SMS alert skipped');
      return false;
    }
    const sent = await this.sms.verify({ to: phone, template: bodyId, tokens: { token } });
    if (!sent.success) this.logger.warn('Melipayamak booking alert was not accepted');
    return sent.success;
  }
}
