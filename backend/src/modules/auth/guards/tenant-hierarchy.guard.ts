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
    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) return false;

    // Check if super_admin bypasses
    if (user.role === 'super_admin' as any || user.role === 'admin') {
      return true;
    }

    // A salon owner or line manager typically needs to act within their own tenantId.
    if (!user.tenantId && user.role !== 'customer') {
      throw new ForbiddenException('شما به هیچ سالنی متصل نیستید');
    }

    return true;
  }
}
