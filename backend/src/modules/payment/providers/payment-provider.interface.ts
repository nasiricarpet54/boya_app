export type PaymentIntentStatus = 'requires_action' | 'succeeded' | 'failed' | 'cancelled';

export interface PaymentIntentResult {
  providerIntentId: string;
  redirectUrl?: string;
  status: PaymentIntentStatus;
}

export interface CreatePaymentIntentInput {
  amount: number;
  bookingId: string;
  tenantId: string;
  description?: string;
}

export interface RefundInput {
  providerIntentId: string;
  amount: number;
}

export interface RefundResult {
  providerRefundId: string;
  amount: number;
  status: 'pending' | 'succeeded';
}

export interface VerifyPaymentResult {
  success: boolean;
  refId?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  verifyPayment(providerIntentId: string, amount: number): Promise<VerifyPaymentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
