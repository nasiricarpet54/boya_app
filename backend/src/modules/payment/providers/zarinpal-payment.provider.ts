import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
} from './payment-provider.interface';

interface ZarinpalRequestResponse {
  data?: { authority?: string; code?: number };
}

interface ZarinpalVerifyResponse {
  data?: { code?: number; ref_id?: number };
}

/** Iranian gateway. Funds land on the platform account; specialist payout is manual. */
@Injectable()
export class ZarinpalPaymentProvider implements PaymentProvider {
  readonly name = 'zarinpal';
  private readonly logger = new Logger(ZarinpalPaymentProvider.name);

  constructor(private readonly config: ConfigService) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const response = await fetch(`${this.baseUrl()}/v4/payment/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId(),
        amount: input.amount,
        description: input.description ?? `رزرو ${input.bookingId}`,
        callback_url: `${this.callbackUrl()}?bookingId=${input.bookingId}`,
        metadata: { booking_id: input.bookingId, tenant_id: input.tenantId },
      }),
    });
    if (!response.ok) throw new BadRequestException('خطا در ارتباط با درگاه پرداخت');

    const data = (await response.json()) as ZarinpalRequestResponse;
    const authority = data.data?.authority;
    if (data.data?.code !== 100 || !authority) {
      throw new BadRequestException('خطا در ایجاد تراکنش. لطفاً دوباره تلاش کنید.');
    }
    return {
      providerIntentId: authority,
      redirectUrl: `${this.startPayUrl()}/${authority}`,
      status: 'requires_action',
    };
  }

  async verifyPayment(authority: string, amount: number): Promise<VerifyPaymentResult> {
    const response = await fetch(`${this.baseUrl()}/v4/payment/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_id: this.merchantId(), amount, authority }),
    });
    if (!response.ok) return { success: false };
    const data = (await response.json()) as ZarinpalVerifyResponse;
    if (data.data?.code === 100 || data.data?.code === 101) {
      return { success: true, refId: data.data.ref_id == null ? undefined : String(data.data.ref_id) };
    }
    return { success: false };
  }

  refund(input: RefundInput): Promise<RefundResult> {
    this.logger.warn(`Zarinpal refund for ${input.providerIntentId} needs manual settlement`);
    return Promise.resolve({
      providerRefundId: `manual-${input.providerIntentId}`,
      amount: input.amount,
      status: 'pending',
    });
  }

  private merchantId(): string {
    return this.config.getOrThrow<string>('ZARINPAL_MERCHANT_ID');
  }

  private callbackUrl(): string {
    return this.config.getOrThrow<string>('ZARINPAL_CALLBACK_URL');
  }

  private baseUrl(): string {
    return this.config.get<string>('ZARINPAL_SANDBOX') === 'true'
      ? 'https://sandbox.zarinpal.com/pg'
      : 'https://payment.zarinpal.com/pg';
  }

  private startPayUrl(): string {
    return this.config.get<string>('ZARINPAL_SANDBOX') === 'true'
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://www.zarinpal.com/pg/StartPay';
  }
}
