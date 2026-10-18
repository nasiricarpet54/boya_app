import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { CreateReviewInput } from './dto/create-review.dto';
import { ReviewService } from './review.service';

/**
 * Feedback is written for the caller's own completed booking. The acting user
 * comes from the token, so a customer cannot file a review against someone
 * else's booking.
 */
@ApiTags('reviews')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Post()
  @ApiOperation({ summary: 'ثبت بازخورد پس از مراجعه (completed → reviewed)' })
  submit(@Body() dto: CreateReviewInput, @CurrentUser() user: AuthenticatedUser) {
    return this.reviews.submit(dto, user.userId);
  }

  @Get()
  @ApiQuery({ name: 'tenantId', required: true })
  list(
    @Query('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return { data: this.reviews.listByTenant(tenantId, limit) };
  }

  @Get(':id')
  @ApiQuery({ name: 'tenantId', required: true })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.reviews.findById(tenantId, id);
  }
}