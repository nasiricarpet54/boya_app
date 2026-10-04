export const BOOKING_CREATED = 'booking.created';
export const BOOKING_CONFIRMED = 'booking.confirmed';
export const BOOKING_CANCELLED = 'booking.cancelled';
export const PAYMENT_CAPTURED = 'payment.captured';
export const REFUND_MARKED = 'payment.refund_marked';
export const REFERRAL_COMPLETED = 'referral.completed';

export interface BookingCreatedEvent {
  bookingId: string;
  tenantId: string;
  customerId: string;
  specialistId: string;
  serviceId: string;
  startsAtIso: string;
}

export interface BookingConfirmedEvent {
  bookingId: string;
  tenantId: string;
  customerId: string;
  specialistId: string;
  serviceId: string;
}

export interface BookingCancelledEvent {
  bookingId: string;
  tenantId: string;
  customerId: string;
  reason: string;
  refundAmount: number;
}

export interface PaymentCapturedEvent {
  bookingId: string;
  tenantId: string;
  customerId: string;
  specialistId: string;
  amount: number;
  /** Read from the transaction metadata, which is written before the capture. */
  isFirstBooking: boolean;
}

export interface RefundMarkedEvent {
  bookingId: string;
  tenantId: string;
  customerId: string;
  amount: number;
}

export interface ReferralCompletedEvent {
  referralId: string;
  tenantId: string;
  referrerId: string;
  referredId: string;
  referrerReward: number;
  referredReward: number;
  /** Loyalty points actually written to the ledger. */
  referrerPoints: number;
  referredPoints: number;
}
