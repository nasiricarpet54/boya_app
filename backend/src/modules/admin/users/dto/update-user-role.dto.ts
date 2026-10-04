import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

/** Body of `PATCH /admin/users/:id/role`. */
export class UpdateUserRoleDto {
  @ApiProperty({
    enum: ['customer', 'salon_owner', 'line_manager', 'specialist', 'admin'],
    example: 'specialist',
  })
  @IsString()
  @IsIn(['customer', 'salon_owner', 'line_manager', 'specialist', 'admin'], {
    message: 'role باید یکی از customer، salon_owner، line_manager، specialist یا admin باشد',
  })
  role!: 'customer' | 'salon_owner' | 'line_manager' | 'specialist' | 'admin';

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'برای نقش‌های salon_owner، line_manager و specialist اجباری است.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'tenantId باید UUID معتبر باشد' })
  tenantId?: string;
}
