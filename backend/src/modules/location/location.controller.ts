import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { LocationService } from './location.service';

/**
 * Province and city lookups for the Home screen's city picker and the profile
 * forms.
 *
 * Every route is public: choosing a city is the first thing a customer does,
 * before there is a token to send, and the data is the same for everyone.
 */
@Public()
@ApiTags('locations')
@Controller('locations')
export class LocationController {
  constructor(private readonly service: LocationService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'فهرست استان‌های ایران' })
  provinces() {
    return this.service.listProvinces();
  }

  @Get('provinces/:id/cities')
  @ApiOperation({ summary: 'فهرست شهرهای یک استان' })
  cities(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listCities(id);
  }

  /**
   * City search across the whole country. Anything shorter than two characters
   * is answered with an empty list rather than hitting Postgres, because a
   * single Persian letter matches hundreds of cities.
   */
  @Get('cities')
  @ApiOperation({ summary: 'جستجوی شهر بر اساس نام' })
  searchCities(@Query('q') q?: string) {
    if (!q || q.trim().length < 2) return [];
    return this.service.searchCities(q.trim());
  }

  /**
   * Turns a GPS fix into a city. The picker's «موقعیت من» entry calls this with
   * the device position; the answer carries the matched catalogue rows so the
   * app selects the city directly.
   */
  @Post('reverse-geocode')
  @ApiOperation({ summary: 'تبدیل مختصات دستگاه به شهر' })
  @ApiBody({ type: ReverseGeocodeDto })
  reverseGeocode(@Body() dto: ReverseGeocodeDto) {
    return this.service.reverseGeocode(dto.lat, dto.lng);
  }
}
