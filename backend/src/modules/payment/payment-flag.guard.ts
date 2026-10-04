import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PaymentService } from './payment.service';

/**
 * Phase 1 keeps online payments off.
 *
 * JwtAuthGuard is global, so a payment call without a token already fails with
 * 401 before this runs; this guard is the second, phase-specific check and is
 * registered per controller rather than globally so the public catalogue is
 * unaffected.
 */
@Injectable()
export class PaymentFeatureFlag implements CanActivate {
  constructor(private readonly payments: PaymentService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.payments.paymentsEnabled) {
      throw new ServiceUnavailableException('در فاز اول، پرداخت آنلاین فعال نیست');
    }
    return true;
  }
}