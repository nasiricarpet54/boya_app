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
 * Runs after `JwtAuthGuard` (both are APP_GUARDs, and guards run in
 * registration order), so `request.user` is always populated here. A route with
 * no metadata is left open to any signed-in user — deliberately, because a
 * blanket "deny by default" would silently break every endpoint that has not
 * been annotated yet, and `.cursorrules` is what tracks that migration.
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
    if (!required || required.length === 0) return true;

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