import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Body of `PATCH /admin/tenants/:id/status`. */
export class UpdateTenantStatusDto {
  @ApiPropertyOptional({
    enum: ['approved', 'suspended'],
    example: 'approved',
    description: 'تغییر وضعیت سالن: تایید یا تعلیق. فعال‌سازی مجدد هم approved است.',
  })
  @IsString()
  @IsIn(['approved', 'suspended'], { message: 'status باید approved یا suspended باشد' })
  status!: 'approved' | 'suspended';

  @ApiPropertyOptional({ example: 'عدم رعایت قوانین انتشار قیمت' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
