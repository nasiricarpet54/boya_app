export type CancellationReason = 'customer_request' | 'specialist_unavailable' | 'no_show';

export interface RefundCalculation {
  refundPercentage: number;
  refundAmount: number;
  penaltyAmount: number;
  reason: string;
}

export interface CancellationInput {
  totalPrice: number;
  startsAt: Date;
  now: Date;
  reason: CancellationReason;
}

/** Refund math only. It does not move money. */
export class CancellationPolicyService {
  calculate(input: CancellationInput): RefundCalculation {
    if (input.reason === 'specialist_unavailable') {
      return this.result(100, input.totalPrice, 'بازپرداخت کامل به دلیل مشکل از سمت ارائه‌دهنده');
    }
    if (input.reason === 'no_show') {
      return this.result(0, input.totalPrice, 'عدم حضور مشتری — بدون بازپرداخت');
    }

    const hours = (input.startsAt.getTime() - input.now.getTime()) / 3_600_000;
    if (hours >= 24) return this.result(100, input.totalPrice, 'لغو بیش از ۲۴ ساعت قبل — بازپرداخت کامل');
    if (hours >= 2) return this.result(50, input.totalPrice, 'لغو بین ۲ تا ۲۴ ساعت قبل — بازپرداخت ۵۰٪');
    return this.result(0, input.totalPrice, 'لغو کمتر از ۲ ساعت قبل — بدون بازپرداخت');
  }

  private result(percentage: number, total: number, reason: string): RefundCalculation {
    const refundAmount = Math.round((total * percentage) / 100);
    return { refundPercentage: percentage, refundAmount, penaltyAmount: total - refundAmount, reason };
  }
}
