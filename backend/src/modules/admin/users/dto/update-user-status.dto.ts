import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Body of `PATCH /admin/users/:id/status`. */
export class UpdateUserStatusDto {
  @ApiProperty({ example: false })
  // No `@Type(() => Boolean)`: it would coerce `'false'` to `true`. The JSON
  // body already carries a real boolean and `@IsBoolean` rejects anything else.
  @IsBoolean({ message: 'isActive باید boolean باشد' })
  isActive!: boolean;

  @ApiPropertyOptional({ example: 'تخلف از قوانین' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
