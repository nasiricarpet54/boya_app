import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { MatchSalonsDto } from './dto/match-salons.dto';
import {
  SalonPanelBookingsQueryDto,
  SalonPanelRejectBookingDto,
} from './dto/salon-bookings-query.dto';
import { SalonAvailabilityQueryDto } from './dto/salon-availability-query.dto';
import { SalonQueryDto } from './dto/salon-query.dto';
import {
  AddPortfolioItemDto,
  CreateSpecialistPanelDto,
  UpdateSpecialistPanelDto,
} from './dto/specialist-panel.dto';
import { UpdateSalonProfileDto } from './dto/update-salon-profile.dto';
import { UpdateSalonScheduleDto } from './dto/update-salon-schedule.dto';
import {
  CreateServiceDto,
  CreateServiceLineDto,
  UpdateServiceDto,
  UpdateServiceLineDto,
} from './dto/update-service-line.dto';
import {
  SalonApprovalStatus,
  SalonAvailability,
  SalonCategoryItem,
  SalonDashboardPayload,
  SalonDetail,
  SalonPage,
  SalonPanelBookingDetail,
  SalonPanelBookingPage,
  SalonPanelWriteResult,
  SalonPanelPortfolio,
  SalonPanelSpecialistCreated,
  SalonPanelSpecialistItem,
  SalonPendingUpdate,
  SalonPortfolio,
  SalonCatalogServices,
  SalonService,
  SalonServiceItem,
  SalonServiceLineItem,
  SalonSpecialists,
  SalonStaffProfile,
} from './salon.service';

/**
 * Public salon catalogue.
 *
 * Browsing is the Phase 1 showcase: the home feed, the category grid, the
 * detail page and the match endpoint must all work before anyone signs in, so
 * the whole controller is marked @Public rather than each handler.
 */
@Public()
@ApiTags('salons')
@Controller('salons')
export class SalonController {
  constructor(private readonly salons: SalonService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست عمومی سالن‌های زیبایی' })
  list(@Query() query: SalonQueryDto): Promise<SalonPage> {
    return this.salons.list(query);
  }

  @Post('match')
  @ApiOperation({
    summary: 'پیشنهاد بهترین سالن بر اساس فیلترها و وزن‌دهی',
    description:
      'پایهٔ قابلیت «بهترین تطابق». خروجی هم‌شکل GET /salons است اما بر اساس امتیاز وزن‌دار مرتب شده. ' +
      'پرچم‌های پریمیوم در فاز ۲ روی همین امتیاز ضرب می‌شوند.',
  })
  match(@Body() body: MatchSalonsDto): Promise<SalonPage> {
    return this.salons.match(body);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'جزئیات یک سالن',
    description: 'از ورودی‌های این مسیر فقط lat/lng مصرف می‌شوند.',
  })
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SalonQueryDto,
  ): Promise<SalonDetail> {
    return this.salons.findOne(id, query);
  }

  /**
   * Bookable times, one row per slot of the salon's day, each flagged
   * `available`. Public like the rest of this controller: the times are shown
   * on the booking form before the customer signs in.
   */
  @Get(':id/available-slots')
  @ApiOperation({
    summary: 'زمان‌های خالی سالن در یک روز برای یک خدمت',
    description:
      'بر اساس working_hours سالن، مدت خدمت و رزروهای موجود. روز تعطیل (مثلاً جمعه) لیست خالی می‌دهد.',
  })
  availableSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SalonAvailabilityQueryDto,
  ): Promise<SalonAvailability> {
    return this.salons.availableSlots(id, query);
  }

  /**
   * Active specialists of a salon, the booking form's specialist picker.
   * `?mobile=true` keeps only the ones who travel to the customer (ADR-011).
   */
  @Get(':id/specialists')
  @Public()
  @ApiOperation({
    summary: 'متخصصان فعال یک سالن',
    description: 'برای فرم رزرو، پیش از ورود کاربر. با ?mobile=true فقط متخصصان سیار.',
  })
  specialists(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SalonQueryDto,
  ): Promise<SalonSpecialists> {
    return this.salons.specialists(id, query.mobile);
  }

  /**
   * Services of a salon, the booking form's service picker (ADR-011).
   * `?mobile=true` keeps only the ones that can be delivered away from the salon.
   */
  @Get(':id/services')
  @Public()
  @ApiOperation({
    summary: 'خدمات یک سالن',
    description: 'برای فرم رزرو. با ?mobile=true فقط خدماتی که سیار ارائه می‌شوند.',
  })
  services(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SalonQueryDto,
  ): Promise<SalonCatalogServices> {
    return this.salons.services(id, query.mobile);
  }

  /**
   * Portfolio photos of the salon's specialists, the detail page's
   * «نمونه‌کارها» tab. Public like the rest of this controller: the gallery is
   * part of the Phase 1 showcase and is shown before anyone signs in.
   */
  @Get(':id/portfolio')
  @Public()
  @ApiOperation({
    summary: 'نمونه‌کارهای متخصصان یک سالن',
    description:
      'همه تصاویر portfolio_images متخصصان فعال سالن. ' +
      'هر آیتم: id، imageUrl، specialistId، specialistName. سالن بدون نمونه‌کار لیست خالی می‌دهد.',
  })
  portfolio(@Param('id', ParseUUIDPipe) id: string): Promise<SalonPortfolio> {
    return this.salons.portfolio(id);
  }
}

/**
 * Salon panel for the signed-in staff user.
 *
 * Unlike the public catalogue above, this controller is NOT @Public: every
 * route requires a JWT and the tenant is taken from the token, never from the
 * request body. A specialist sees only their own rows; owners and managers see
 * the whole salon.
 */
@ApiTags('salon-panel')
@Controller('salon')
export class SalonPanelController {
  constructor(private readonly salons: SalonService) {}

  /**
   * Approval state of the caller's own salon, so the app can show the right
   * banner: "awaiting review", "rejected — reason", or nothing at all.
   */
  @Get('me/status')
  @ApiOperation({
    summary: 'وضعیت تایید سالن کاربر واردشده',
    description:
      'وضعیت تایید سالن به همراه دلیل رد (در صورت وجود) و اینکه ' +
      'تغییراتی در انتظار بررسی ادمین هست یا نه.',
  })
  status(@CurrentUser() user: AuthenticatedUser): Promise<SalonApprovalStatus> {
    return this.salons.staffApprovalStatus(user);
  }

  /** The signed-in staff user's own salon. */
  @Get('me')
  @ApiOperation({ summary: 'اطلاعات سالن کاربر واردشده' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SalonStaffProfile> {
    return this.salons.staffTenant(user);
  }

  /**
   * The approval-gated profile fields.
   *
   * The response is deliberately not the updated profile: nothing has changed
   * on the live row yet, only the request has been staged for review, so the
   * caller cannot mistake a queued edit for an applied one.
   */
  @Patch('me')
  @ApiOperation({
    summary: 'ویرایش اطلاعات سالن (نیازمند تایید ادمین)',
    description:
      'فیلدهای name/address/phone/coverImage/workingHours در pending_changes ' +
      'ذخیره و وضعیت به pending_approval تغییر می‌کند. رکورد اصلی تا تایید ادمین ' +
      'تغییر نمی‌کند، بنابراین GET /salons همچنان نام قبلی را برمی‌گرداند.',
  })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSalonProfileDto,
  ): Promise<SalonPendingUpdate> {
    return this.salons.updateStaffProfile(user, dto);
  }

  /** The weekly schedule, approval-gated exactly like the profile fields. */
  @Patch('me/schedule')
  @ApiOperation({
    summary: 'ویرایش ساعات کاری سالن (نیازمند تایید ادمین)',
    description:
      'همان منطق PATCH /salon/me: workingHours در pending_changes ذخیره می‌شود و ' +
      'تا تایید ادمین اعمال نمی‌شود.',
  })
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSalonScheduleDto,
  ): Promise<SalonPendingUpdate> {
    return this.salons.updateStaffSchedule(user, dto);
  }

  /** Service lines of the signed-in salon, with each line's service count. */
  @Get('me/lines')
  @ApiOperation({ summary: 'لاین‌های خدماتی سالن کاربر واردشده' })
  listLines(@CurrentUser() user: AuthenticatedUser): Promise<SalonServiceLineItem[]> {
    return this.salons.listServiceLines(user);
  }

  /** Create a service line; the line waits for admin approval. */
  @Post('me/lines')
  @ApiOperation({ summary: 'افزودن لاین خدماتی (نیازمند تایید ادمین)' })
  createLine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceLineDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.createServiceLine(user, dto);
  }

  /** Edit a service line; only a name change re-queues approval. */
  @Patch('me/lines/:id')
  @ApiOperation({ summary: 'ویرایش لاین خدماتی' })
  updateLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceLineDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.updateServiceLine(user, id, dto);
  }

  /** Soft-delete a line; blocked if any of its services has an active booking. */
  @Delete('me/lines/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف لاین خدماتی' })
  deleteLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.deleteServiceLine(user, id);
  }

  /** Services of one line. */
  @Get('me/lines/:lineId/services')
  @ApiOperation({ summary: 'خدمات یک لاین خدماتی' })
  listServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ): Promise<SalonServiceItem[]> {
    return this.salons.listServices(user, lineId);
  }

  /** Add a service to a line; effective immediately (no approval workflow). */
  @Post('me/lines/:lineId/services')
  @ApiOperation({ summary: 'افزودن خدمت به لاین' })
  createService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: CreateServiceDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.createService(user, lineId, dto);
  }

  /** Edit a service; effective immediately. */
  @Patch('me/services/:id')
  @ApiOperation({ summary: 'ویرایش خدمت' })
  updateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.updateService(user, id, dto);
  }

  /** Soft-delete a service. */
  @Delete('me/services/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف خدمت' })
  deleteService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.deleteService(user, id);
  }

  /** Specialists of the signed-in salon, inactive ones included. */
  @Get('me/specialists')
  @ApiOperation({ summary: 'متخصصان سالن کاربر واردشده' })
  listSpecialists(@CurrentUser() user: AuthenticatedUser): Promise<SalonPanelSpecialistItem[]> {
    return this.salons.listPanelSpecialists(user);
  }

  /** Register a specialist; effective immediately (no approval workflow). */
  @Post('me/specialists')
  @ApiOperation({ summary: 'افزودن متخصص' })
  createSpecialist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSpecialistPanelDto,
  ): Promise<SalonPanelSpecialistCreated> {
    return this.salons.createPanelSpecialist(user, dto);
  }

  /** Edit a specialist's bio/skills/commission or toggle their visibility. */
  @Patch('me/specialists/:id')
  @ApiOperation({ summary: 'ویرایش متخصص' })
  updateSpecialist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialistPanelDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.updatePanelSpecialist(user, id, dto);
  }

  /** Soft-delete a specialist; blocked while active bookings exist. */
  @Delete('me/specialists/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف متخصص' })
  deleteSpecialist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.deletePanelSpecialist(user, id);
  }

  /** Portfolio photos of the salon's specialists, inactive ones included. */
  @Get('me/portfolio')
  @ApiOperation({ summary: 'نمونه‌کارهای سالن کاربر واردشده' })
  listPortfolio(@CurrentUser() user: AuthenticatedUser): Promise<SalonPanelPortfolio> {
    return this.salons.listPanelPortfolio(user);
  }

  /** Add a portfolio photo; the tenant goes to pending approval. */
  @Post('me/portfolio')
  @ApiOperation({ summary: 'افزودن نمونه‌کار (نیازمند تایید ادمین)' })
  addPortfolioItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPortfolioItemDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.addPanelPortfolioItem(user, dto);
  }

  /** Delete a portfolio photo; the tenant goes to pending approval. */
  @Delete('me/portfolio/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف نمونه‌کار (نیازمند تایید ادمین)' })
  deletePortfolioItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.deletePanelPortfolioItem(user, id);
  }

  /**
   * The panel's booking list, scoped to what the caller's role may see.
   *
   * Every filter is optional, so the screen can open on "everything" and
   * narrow down. `page`/`limit` come from the DTO with their own defaults, and
   * the reply carries the per-status counts for the same window so the filter
   * tabs agree with the rows underneath them.
   */
  @Get('me/bookings')
  @ApiOperation({ summary: 'لیست رزروهای سالن کاربر واردشده' })
  listBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalonPanelBookingsQueryDto,
  ): Promise<SalonPanelBookingPage> {
    return this.salons.listPanelBookings(user, query);
  }

  /** One booking of the signed-in salon, with the working hours to judge it against. */
  @Get('me/bookings/:id')
  @ApiOperation({ summary: 'جزئیات یک رزرو' })
  getBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelBookingDetail> {
    return this.salons.getPanelBooking(user, id);
  }

  /** Confirm a pending booking; the customer is notified. */
  @Post('me/bookings/:id/approve')
  @ApiOperation({ summary: 'تایید رزرو' })
  approveBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelBookingDetail> {
    return this.salons.approvePanelBooking(user, id);
  }

  /**
   * Decline a pending booking. The reason is required because it is the text
   * the customer is shown, so an unexplained cancellation is not possible.
   */
  @Post('me/bookings/:id/reject')
  @ApiOperation({ summary: 'رد رزرو' })
  rejectBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalonPanelRejectBookingDto,
  ): Promise<SalonPanelBookingDetail> {
    return this.salons.rejectPanelBooking(user, id, dto);
  }

  /** Mark a confirmed booking as done; only the salon can assert the visit happened. */
  @Post('me/bookings/:id/mark-visited')
  @ApiOperation({ summary: 'ثبت مراجعه انجام‌شده' })
  markVisitedBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelBookingDetail> {
    return this.salons.markVisitedPanelBooking(user, id);
  }

  /**
   * Mark a confirmed booking as a no-show. The service only allows this once
   * the slot has started, so a booking cannot be written off in advance.
   */
  @Post('me/bookings/:id/no-show')
  @ApiOperation({ summary: 'ثبت عدم مراجعه' })
  noShowBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelBookingDetail> {
    return this.salons.noShowPanelBooking(user, id);
  }

  /** Today/week snapshot of the signed-in staff user's salon. */
  @Get('dashboard')
  @ApiOperation({ summary: 'داشبورد سالن کاربر واردشده' })
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<SalonDashboardPayload> {
    return this.salons.staffDashboard(user);
  }
}
@Public()
@ApiTags('salons')
@Controller('categories')
export class CategoryController {
  constructor(private readonly salons: SalonService) {}

  @Get()
  @ApiOperation({ summary: 'دسته‌بندی‌های خدمات زیبایی' })
  list(): Promise<{ data: SalonCategoryItem[] }> {
    return this.salons.listCategories();
  }
}
