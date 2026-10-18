import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from './jwt-auth.guard';

@Injectable()
export class TenantHierarchyGuard implements CanActivate {
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

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) return false;

    // Check if super_admin bypasses
    if ((user.role as string) === 'super_admin' || user.role === 'admin') {
      return true;
    }

    // A salon owner or line manager typically needs to act within their own tenantId.
    if (!user.tenantId && user.role !== 'customer') {
      throw new ForbiddenException('شما به هیچ سالنی متصل نیستید');
    }

    return true;
  }
}
