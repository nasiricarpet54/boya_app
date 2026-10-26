import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * Body of `PATCH /salon/me`.
 *
 * Only `name` and `address` can be updated. Every field here is approval-gated:
 * the values are stored in `tenants.pending_changes` and the live row is left
 * untouched until an admin approves. Max lengths mirror the column widths in
 * migrations 1730000000002 and 1730000000009.
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
}