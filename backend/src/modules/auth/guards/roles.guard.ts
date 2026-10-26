import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from './jwt-auth.guard';

/**
 * Enforces `@Roles(...)`.
 *
 * Registered as an APP_GUARD *after* `JwtAuthGuard` (app.module.ts), so
 * `request.user` is always populated here. A route with no metadata is
 * **denied**: every endpoint must declare its roles explicitly (or carry
 * `@Public()`), which is what makes "a specialist may not reach the customer
 * management API" a property of the route table rather than of each caller's
 * goodwill. The only exceptions are `@Public()` (OTP/refresh/invite-accept and
 * the public catalogue) and the health probe.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Bulletproof fallback: explicitly bypass for HealthController
    const controllerName = context.getClass().name;
    if (controllerName === 'HealthController') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<AuthenticatedUser['role'][] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      // Deny by default: an endpoint that never declared who may call it is
      // not reachable, rather than silently open to every signed-in user.
      throw new ForbiddenException('دسترسی لازم برای این عملیات را ندارید');
    }

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('دسترسی لازم برای این عملیات را ندارید');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException('دسترسی لازم برای این عملیات را ندارید');
    }
    return true;
  }
}