import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of `PATCH /salon/me`.
 *
 * Every field here is approval-gated: the values are stored in
 * `tenants.pending_changes` and the live row is left untouched until an admin
 * approves. Max lengths mirror the column widths in migrations 1730000000002
 * and 1730000000009.
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

  @ApiPropertyOptional({ maxLength: 20, example: '09121234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'https://cdn.boya.ir/salon/cover.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { saturday: { active: true, start: '09:00', end: '21:00' } },
  })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;
}