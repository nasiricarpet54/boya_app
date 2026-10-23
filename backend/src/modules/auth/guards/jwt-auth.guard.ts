import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../../user/entities/user.entity';

/** Claims lifted off a verified access token. */
export interface AuthenticatedUser {
  userId: string;
  phoneNumber: string;
  role: UserRole;
  tenantId: string | null;
}

interface TokenPayload {
  sub: string;
  phone: string;
  role: AuthenticatedUser['role'];
  tenantId?: string | null;
}

/**
 * Verifies the `Authorization: Bearer` header and attaches `request.user`.
 *
 * Registered as an APP_GUARD, so it runs on every route. Endpoints that must
 * stay reachable without a token carry `@Public()`; `Reflector` reads that
 * metadata first so the public ones never reach the header check.
 *
 * The payload is read, not cast: `sub` and `role` are what every downstream
 * authorisation decision relies on, so a token missing them is rejected rather
 * than producing a half-built user object.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.slice(7);
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      userId: payload.sub,
      phoneNumber: payload.phone ?? '',
      role: payload.role,
      tenantId: payload.tenantId ?? null,
    } satisfies AuthenticatedUser;
    return true;
  }
}