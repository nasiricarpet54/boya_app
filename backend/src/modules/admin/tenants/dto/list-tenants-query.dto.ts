import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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
}
