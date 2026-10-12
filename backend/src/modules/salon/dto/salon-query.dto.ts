import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum SalonSort {
  Distance = 'distance',
  Rating = 'rating',
  Price = 'price',
  Newest = 'newest',
}

/** `?lat=` (empty) must mean "no coordinate", not 0, which is open ocean. */
function toOptionalNumber({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' ? Number(value.trim()) : Number(value);
}

/**
 * Query booleans arrive as strings and class-transformer does not coerce them
 * implicitly, so `?mobile=true` is parsed here. An unrecognised value is passed
 * through untouched for `@IsBoolean()` to reject, instead of being silently
 * treated as "no filter".
 */
function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (trimmed === 'true' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === '0') return false;
  return value;
}

export class SalonQueryDto {
  @ApiPropertyOptional({ example: 35.758, description: 'Consumer latitude, for distance sorting' })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 51.41 })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: 'hair-color', description: 'service_categories.slug' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  /** Alias of `category`, kept for clients that spell it out. */
  @ApiPropertyOptional({ example: 'hair-color', deprecated: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  categorySlug?: string;

  @ApiPropertyOptional({ enum: SalonSort, default: SalonSort.Rating })
  @IsOptional()
  @IsEnum(SalonSort)
  sort?: SalonSort;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50 })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  /**
   * ADR-011: keep only salons that can actually deliver on-site — at least one
   * active specialist who travels *and* at least one active service that can
   * leave the salon.
   */
  @ApiPropertyOptional({
    example: true,
    description: 'فقط سالن‌هایی که خدمات سیار ارائه می‌دهند',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  mobile?: boolean;

  /** `cities.id` — narrow the feed to one city (migration 1730000000038). */
  @ApiPropertyOptional({ example: 'b1c2d3e4-...', description: 'city_id از جدول cities' })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  /** `provinces.id` — narrow the feed to one province (migration 1730000000038). */
  @ApiPropertyOptional({ example: 'a0b1c2d3-...', description: 'province_id از جدول provinces' })
  @IsOptional()
  @IsUUID()
  provinceId?: string;
}
