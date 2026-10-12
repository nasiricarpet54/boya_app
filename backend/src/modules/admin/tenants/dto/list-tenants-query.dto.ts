import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Query of `GET /admin/tenants`. */
export class ListTenantsQueryDto {
  @ApiPropertyOptional({ example: 'آروشا' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ['approved', 'pending_approval', 'rejected', 'suspended', 'archived', 'all'],
    example: 'all',
  })
  @IsOptional()
  @IsIn(['approved', 'pending_approval', 'rejected', 'suspended', 'archived', 'all'], {
    message: 'status باید یکی از approved، pending_approval، rejected، suspended، archived یا all باشد',
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

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'فیلتر استان (provinces.id، migration 1730000000038).',
  })
  @IsOptional()
  @IsUUID('4', { message: 'provinceId باید UUID معتبر باشد' })
  provinceId?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'فیلتر شهر (cities.id، migration 1730000000038).',
  })
  @IsOptional()
  @IsUUID('4', { message: 'cityId باید UUID معتبر باشد' })
  cityId?: string;
}
