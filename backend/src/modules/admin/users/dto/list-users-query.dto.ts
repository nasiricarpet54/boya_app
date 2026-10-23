import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Query of `GET /admin/users`. */
export class ListUsersQueryDto {
  @ApiPropertyOptional({ example: '09121234567' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ['customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'freelance_mobile', 'all'],
    example: 'all',
  })
  @IsOptional()
  @IsIn(['customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'freelance_mobile', 'all'], {
    message: 'role باید یکی از customer، salon_owner، line_manager، specialist، admin، freelance_mobile یا all باشد',
  })
  role?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'], example: 'all' })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'], {
    message: 'status باید یکی از active، inactive یا all باشد',
  })
  status?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
