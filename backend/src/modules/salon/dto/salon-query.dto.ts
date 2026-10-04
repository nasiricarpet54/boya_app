import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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
}
