import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

/**
 * BUG-6 — `POST /payments/initiate` trusted the tenant id in the body.
 *
 * The controller read `tenantId` from `@Body()` and handed it straight to the
 * service, so a caller could ask to charge a booking belonging to *any* salon
 * (tenant_B) even though their token only authorises tenant_A. The tenant must
 * come from the verified JWT, exactly like `booking.controller.ts` refuses to
 * take `customerId` from the body.
 *
 * Before the fix the controller forwards `body.tenantId`; after the fix it
 * forwards `user.tenantId`, and rejects a caller with no tenant (a customer)
 * with 403. This spec asserts both against a mocked service, so it guards the
 * routing logic and needs no payment provider.
 */
describe('BUG-6: payment initiate must bind the tenant to the JWT, not the body', () => {
  let controller: PaymentController;
  let initiate: jest.Mock;

  const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const BOOKING = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const userOf = (role: AuthenticatedUser['role'], tenantId: string | null): AuthenticatedUser => ({
    userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    phoneNumber: '09120009941',
    role,
    tenantId,
  });

  beforeEach(() => {
    initiate = jest.fn().mockResolvedValue({ id: 'pending-tx' });
    controller = new PaymentController({ initiate } as unknown as PaymentService);
  });

  it('uses the token tenant and ignores any tenant sent alongside the booking', async () => {
    const user = userOf('salon_owner', TENANT_A);
    // A caller trying to act on tenant_B by putting it in the body: the DTO no
    // longer has a tenantId field, and the controller reads the token instead.
    await controller.initiate({ bookingId: BOOKING, tenantId: TENANT_B } as never, user);
    expect(initiate).toHaveBeenCalledTimes(1);
    expect(initiate).toHaveBeenCalledWith(TENANT_A, BOOKING);
  });

  it('forwards the tenant when the body carries only the booking', async () => {
    const user = userOf('salon_owner', TENANT_A);
    await controller.initiate({ bookingId: BOOKING }, user);
    expect(initiate).toHaveBeenCalledWith(TENANT_A, BOOKING);
  });

  it('rejects a caller with no tenant (customer) with 403', async () => {
    const user = userOf('customer', null);
    expect(() => controller.initiate({ bookingId: BOOKING }, user)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
    expect(initiate).not.toHaveBeenCalled();
  });
});
