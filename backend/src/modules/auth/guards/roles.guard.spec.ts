import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Roles } from '../decorators/roles.decorator';
import { Public } from '../decorators/public.decorator';
import { RolesGuard } from './roles.guard';

/** Builds a guard context for the given controller/handler class pair. */
const contextOf = (controller: new (...args: unknown[]) => unknown, handler: string) =>
  ({
    getClass: () => controller,
    getHandler: () => (controller.prototype as Record<string, unknown>)[handler],
    switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
  }) as unknown as ExecutionContext;

class OwnerRoutes {
  @Roles('salon_owner')
  async ownerOnly() {}
}

class OpenRoutes {
  @Public()
  async sendOtp() {}
}

class UnannotatedRoutes {
  async forgotToDeclare() {}
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('admits a user whose role is listed', async () => {
    const ctx = {
      getClass: () => OwnerRoutes,
      getHandler: () => OwnerRoutes.prototype.ownerOnly,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'salon_owner' } }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects a user whose role is not listed', async () => {
    const ctx = {
      getClass: () => OwnerRoutes,
      getHandler: () => OwnerRoutes.prototype.ownerOnly,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'specialist' } }) }),
    } as unknown as ExecutionContext;
    await expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies by default when no @Roles is declared', async () => {
    // An endpoint that never said who may call it is unreachable: that is what
    // "the role table is closed" means, and it is the rule that keeps an
    // accidental future endpoint from silently admitting every signed-in user.
    await expect(() => guard.canActivate(contextOf(UnannotatedRoutes, 'forgotToDeclare'))).toThrow(
      ForbiddenException,
    );
  });

  it('still lets @Public routes through unauthenticated', async () => {
    await expect(guard.canActivate(contextOf(OpenRoutes, 'sendOtp'))).toBe(true);
  });
});
