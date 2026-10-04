import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Body of `POST /admin/approvals/:type/:id/reject`. */
export class RejectApprovalDto {
  @ApiProperty({ example: 'نام سالن شامل کلمات تبلیغاتی مجاز نیست' })
  @IsString()
  @IsNotEmpty({ message: 'دلیل رد الزامی است' })
  @MinLength(3, { message: 'دلیل رد باید حداقل ۳ نویسه باشد' })
  @MaxLength(500)
  reason!: string;
}