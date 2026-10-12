import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
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
}
