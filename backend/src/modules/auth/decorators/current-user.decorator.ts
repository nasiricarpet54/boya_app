import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../guards/jwt-auth.guard';

/**
 * Injects the verified user. Only valid on routes JwtAuthGuard protects, so
 * `request.user` is always present when a handler runs.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);