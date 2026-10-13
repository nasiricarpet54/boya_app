import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

/**
 * `POST /locations/reverse-geocode`: a device GPS fix the API resolves to the
 * Iranian city it falls in.
 *
 * The bounds are the coordinate ranges themselves, so a request that sends
 * something a coordinate cannot be is a 400 before Neshan is ever called.
 */
export class ReverseGeocodeDto {
  @ApiProperty({ example: 35.7575 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 51.41 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}
