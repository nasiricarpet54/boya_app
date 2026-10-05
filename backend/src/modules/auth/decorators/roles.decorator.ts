import { SetMetadata } from '@nestjs/common';

import { AuthenticatedUser } from '../guards/jwt-auth.guard';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles, checked by `RolesGuard`.
 *
 * `.cursorrules` requires every endpoint to declare its roles, so this is the
 * mechanism that makes "salon_owner may create invites, customer may not" a
 * statement in the controller rather than an `if` buried in a service. A route
 * with no `@Roles()` and no `@Public()` is reachable by any signed-in user,
 * which is why the invite routes all carry one.
 */
export const Roles = (...roles: AuthenticatedUser['role'][]) =>
  SetMetadata(ROLES_KEY, roles);