import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from './jwt-auth.guard';

@Injectable()
export class TenantHierarchyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.originalUrl || request.url;

    // Bypass tenantId check for /api/v1/auth/me and similar User Info endpoints
    if (path.includes('/auth/me')) {
      const user = request.user as AuthenticatedUser | undefined;
      if (!user) return false;
      return true;
    }

    const user = request.user as AuthenticatedUser | undefined;
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
