import { IsIn, IsString } from 'class-validator';

import { USER_ROLES, UserRole } from '../../user/entities/user.entity';

/** Body of `POST /auth/switch-role`: the role the caller wants to act under. */
export class SwitchRoleDto {
  @IsString()
  @IsIn(USER_ROLES)
  role!: UserRole;
}
