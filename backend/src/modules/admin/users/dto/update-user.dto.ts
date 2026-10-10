import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body of `PATCH /admin/users/:id` (edit of the user's display name). */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'مریم رضایی', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'نام حداقل ۱ حرف است' })
  @MaxLength(100, { message: 'نام حداکثر ۱۰۰ حرف است' })
  fullName?: string;
}
