import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Relative importance of each criterion. Normalised by the service. */
export class SortWeights {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  distance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rating?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  discount?: number;
}

/**
 * `POST /salons/match` body. Every field is optional: a caller that only sends
 * coordinates still gets a rating-ordered list.
 */
export class MatchSalonsDto {
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDistanceKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsBoolean()
  onlyDiscounted?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SortWeights)
  sortWeights?: SortWeights;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsObject()
  @Type(() => SortWeights)
  @ValidateNested()
  weights?: SortWeights;
}