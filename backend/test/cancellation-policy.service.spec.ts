import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CancellationPolicyService } from '../src/modules/booking/cancellation-policy.service';

describe('CancellationPolicyService', () => {
  const service = new CancellationPolicyService();
  const startsAt = new Date('2026-10-20T10:00:00Z');
  const before = (hours: number) => new Date(startsAt.getTime() - hours * 3_600_000);

  test('full refund at 24 hours', () => {
    const result = service.calculate({ totalPrice: 1_000_000, startsAt, now: before(24), reason: 'customer_request' });
    assert.equal(result.refundPercentage, 100);
    assert.equal(result.penaltyAmount, 0);
  });

  test('half refund at 12 hours', () => {
    const result = service.calculate({ totalPrice: 1_000_000, startsAt, now: before(12), reason: 'customer_request' });
    assert.equal(result.refundAmount, 500_000);
  });

  test('no refund inside 2 hours or on no-show', () => {
    assert.equal(
      service.calculate({ totalPrice: 1_000_000, startsAt, now: before(1), reason: 'customer_request' }).refundPercentage,
      0,
    );
    assert.equal(service.calculate({ totalPrice: 1_000_000, startsAt, now: before(0), reason: 'no_show' }).refundPercentage, 0);
  });

  test('specialist unavailability is always a full refund', () => {
    assert.equal(
      service.calculate({ totalPrice: 1_000_000, startsAt, now: before(1), reason: 'specialist_unavailable' }).refundPercentage,
      100,
    );
  });
});
