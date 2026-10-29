import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ description: 'عنوان آدرس (مثال: خانه، محل کار)', example: 'خانه' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'متن کامل آدرس', example: 'تهران، خیابان ولیعصر، میدان ونک، کوچه ...' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ description: 'کد پستی', example: '1234567890' })
  @IsString()
  @IsOptional()
  postalCode?: string | null;

  @ApiPropertyOptional({ description: 'مختصات جغرافیایی - عرض از مرکز', example: 35.6892 })
  @IsNumber()
  @IsOptional()
  latitude?: number | null;

  @ApiPropertyOptional({ description: 'مختصات جغرافیایی - طول از مرکز', example: 51.389 })
  @IsNumber()
  @IsOptional()
  longitude?: number | null;
}
