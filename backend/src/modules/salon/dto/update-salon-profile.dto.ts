import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of `PATCH /salon/me`.
 *
 * The five gated fields are approval-gated: the values are stored in
 * `tenants.pending_changes` and the live row is left untouched until an admin
 * approves. Max lengths mirror the column widths in migrations
 * 1730000000002 (`phone` VARCHAR(20), `address` TEXT) and 1730000000009
 * (`cover_image_url` VARCHAR(500), `working_hours` JSONB).
 *
 * A field left out keeps whatever is already pending, so a second PATCH
 * carrying just the phone number cannot silently discard a name that is still
 * waiting for review. An explicit null is dropped rather than stored: the
 * approve-side merge reads `pending_changes` with `COALESCE(->> key, column)`
 * and could not tell a deliberate null apart from an absent key.
 */
export class UpdateSalonProfileDto {
  @ApiPropertyOptional({ maxLength: 200, example: 'آرایشی نگین' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'تهران، خیابان ولیعصر' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  /** `tenants.phone`, VARCHAR(20) — an 11-digit Iranian mobile. */
  @ApiPropertyOptional({ maxLength: 20, example: '09121234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** `tenants.cover_image_url`, VARCHAR(500) — a path relative to the uploads root. */
  @ApiPropertyOptional({ maxLength: 500, example: '/uploads/tenant-1/salon/3f9a.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  /** `tenants.working_hours`, JSONB — the weekly schedule shape from `working-hours.util`. */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      saturday: { active: true, start: '09:00', end: '21:00' },
      friday: { active: false },
    },
  })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;
}
