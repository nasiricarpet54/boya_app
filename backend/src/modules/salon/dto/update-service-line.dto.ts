import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Body of `PATCH /salon/me/lines/:id`.
 *
 * `name` is the only approval-gated field: changing it flips the line to
 * `pending_approval` and hides it from the public catalogue until an admin
 * approves (service_lines rows publish on `status = 'approved'`). The
 * `description` and `is_active` edits are cosmetic and land immediately.
 */
export class UpdateServiceLineDto {
  @ApiPropertyOptional({ maxLength: 100, example: 'رنگ و مش' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'رنگ، مش و هایلایت' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Body of `POST /salon/me/lines`. A new line is always `pending_approval`; the
 * row is created but stays hidden from the public catalogue until an admin
 * approves it.
 */
export class CreateServiceLineDto {
  @ApiProperty({ maxLength: 100, example: 'رنگ و مش' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'رنگ، مش و هایلایت' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/** Body of `PATCH /salon/me/services/:id`. All fields, freely editable. */
export class UpdateServiceDto {
  @ApiPropertyOptional({ maxLength: 200, example: 'رنگ کامل مو' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'شامل شامپو و سشوار' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 850000, description: 'تومان' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 60, description: 'دقیقه' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  depositRequired?: boolean;

  @ApiPropertyOptional({ example: 100000, description: 'تومان' })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * ADR-011: this service can be delivered away from the salon. Freely
   * editable like the rest of this DTO — it is an operational fact about the
   * service, not a detail the admin needs to vet.
   */
  @ApiPropertyOptional({ example: true, description: 'این خدمت سیار ارائه می‌شود' })
  @IsOptional()
  @IsBoolean()
  isMobileAvailable?: boolean;
}

/** Body of `POST /salon/me/lines/:lineId/services`. All fields, freely editable. */
export class CreateServiceDto {
  @ApiProperty({ maxLength: 200, example: 'رنگ کامل مو' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'شامل شامپو و سشوار' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 850000, description: 'تومان' })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 60, description: 'دقیقه' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  depositRequired?: boolean;

  @ApiPropertyOptional({ example: 100000, description: 'تومان' })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmount?: number;
}
