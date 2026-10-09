import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

import { normalizePhone } from '../../../auth/utils/phone.util';

/** Body of `POST /admin/users`. */
export class CreateUserDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  // Same normaliser as the rest of the app (Persian/Arabic-Indic digits to
  // Latin, `+98`/`0098`/`912…` to a leading `0`) before the 09… rule applies.
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل وارد شده معتبر نیست' })
  phone!: string;

  @ApiProperty({
    enum: ['customer', 'salon_owner', 'line_manager', 'specialist', 'admin'],
    example: 'specialist',
  })
  @IsString()
  @IsIn(['customer', 'salon_owner', 'line_manager', 'specialist', 'admin'], {
    message: 'role باید یکی از customer، salon_owner، line_manager، specialist یا admin باشد',
  })
  role!: 'customer' | 'salon_owner' | 'line_manager' | 'specialist' | 'admin';

  @ApiPropertyOptional({ example: 'مریم رضایی', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'نام حداکثر ۱۰۰ حرف است' })
  fullName?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'برای نقش specialist ردیف متخصص هم ساخته می‌شود.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'tenantId باید UUID معتبر باشد' })
  tenantId?: string;
}
