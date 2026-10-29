import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import {
  UseGuards,
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
  Put,
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
import { CreateScheduleBlockDto } from './dto/salon-schedule-block.dto';
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
import { SetSpecialistServicesDto } from './dto/specialist-services.dto';
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
  SalonSpecialistServiceItem,
  SalonSpecialistServices,
  SalonSpecialists,
  SalonStaffProfile,
  SalonScheduleBlockList,
} from './salon.service';

import { MobileSpecialistDto } from './dto/mobile-specialist.dto';

/**
 * Public salon catalogue.
 *
 * Browsing is the Phase 1 showcase: the home feed, the category grid, the
 * detail page and the match endpoint must all work before anyone signs in, so
 * the whole controller is marked @Public rather than each handler.
 */
@Public()
@ApiTags('salons')
@UseGuards(RolesGuard, TenantHierarchyGuard)
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
   * The services one specialist offers — the only list the booking form may
   * show once the customer picked a specialist. Backed by `specialist_services`
   * (migration 1792900000000), never the salon's whole catalogue, so a
   * specialist appears next to exactly the services the salon assigned them.
   * A specialist unknown to or inactive in this salon answers 404.
   */
  @Get(':id/specialists/:specialistId/services')
  @Public()
  @ApiOperation({
    summary: 'خدمات تعریف‌شده برای یک متخصص',
    description:
      'فقط خدمات فعالِ اختصاص‌داده‌شده به این متخصص در این سالن. اگر متخصص در این سالن فعال نباشد، ۴۰۴.',
  })
  specialistServices(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('specialistId', ParseUUIDPipe) specialistId: string,
  ): Promise<SalonSpecialistServices> {
    return this.salons.specialistServices(id, specialistId);
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
  @Roles('salon_owner', 'line_manager', 'specialist', 'employed', 'booth_renter', 'admin')
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
  @Roles('salon_owner', 'line_manager', 'specialist', 'employed', 'booth_renter', 'admin')
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
  @Roles('salon_owner', 'line_manager', 'admin')
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
  @Roles('salon_owner', 'line_manager', 'admin')
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

  /**
   * Block a time range in the schedule (for walk-in customers, breaks, or
   * personal time off). Blocking a time excludes it from the public
   * availability list, exactly as if a booking already existed.
   *
   * `blockScope` in the service is the real gate: a salon staff token writes
   * into its own tenant, a `freelance_mobile` token onto its own calendar.
   */
  @Roles('salon_owner', 'line_manager', 'specialist', 'admin', 'booth_renter', 'freelance_mobile')
  @Post('me/schedule/block')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'ایجاد مسدودی زمان در تقویم سالن یا متخصص',
    description:
      'زمان مسدود شده از لیست نوبت‌های خالی حذف می‌شود (مشابه زمانی که رزرو ثبت شده باشد). ' +
      'برای مشتریان حضوری یا استراحت استفاده می‌شود.',
  })
  createScheduleBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleBlockDto,
  ): Promise<{ id: string }> {
    return this.salons.createScheduleBlock(user, dto);
  }

  /**
   * Remove a schedule block. The freed time immediately becomes bookable again.
   * A mobile caller may only remove a block from their own calendar.
   */
  @Roles('salon_owner', 'line_manager', 'specialist', 'admin', 'booth_renter', 'freelance_mobile')
  @Delete('me/schedule/block/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف مسدودی زمان از تقویم' })
  deleteScheduleBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.salons.deleteScheduleBlock(user, id);
  }

  /**
   * All schedule blocks of the signed-in provider: the salon's blocks for
   * staff, the caller's own blocks for a mobile specialist. One row per
   * blocked range; use `specialistId`/`salonId` to tell a whole-salon block
   * (or a mobile block) from a single specialist's.
   */
  @Roles('salon_owner', 'line_manager', 'specialist', 'admin', 'booth_renter', 'freelance_mobile')
  @Get('me/schedule/blocks')
  @ApiOperation({ summary: 'فهرست مسدودی‌های زمان تقویم' })
  listScheduleBlocks(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalonScheduleBlockList> {
    return this.salons.listScheduleBlocks(user);
  }

  /** Service lines of the signed-in salon, with each line's service count. */
  @Roles('salon_owner')
  @Get('me/lines')
  @ApiOperation({ summary: 'لاین‌های خدماتی سالن کاربر واردشده' })
  listLines(@CurrentUser() user: AuthenticatedUser): Promise<SalonServiceLineItem[]> {
    return this.salons.listServiceLines(user);
  }

  /** Create a service line; the line waits for admin approval. */
  @Roles('salon_owner')
  @Post('me/lines')
  @ApiOperation({ summary: 'افزودن لاین خدماتی (نیازمند تایید ادمین)' })
  createLine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceLineDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.createServiceLine(user, dto);
  }

  /** Edit a service line; only a name change re-queues approval. */
  @Roles('salon_owner')
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
  @Roles('salon_owner')
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
  @Roles('salon_owner')
  @Get('me/lines/:lineId/services')
  @ApiOperation({ summary: 'خدمات یک لاین خدماتی' })
  listServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ): Promise<SalonServiceItem[]> {
    return this.salons.listServices(user, lineId);
  }

  /** Add a service to a line; effective immediately (no approval workflow). */
  @Roles('salon_owner')
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
  @Roles('salon_owner')
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
  @Roles('salon_owner')
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
  @Roles('salon_owner')
  @Get('me/specialists')
  @ApiOperation({ summary: 'متخصصان سالن کاربر واردشده' })
  listSpecialists(@CurrentUser() user: AuthenticatedUser): Promise<SalonPanelSpecialistItem[]> {
    return this.salons.listPanelSpecialists(user);
  }

  /** Register a specialist; effective immediately (no approval workflow). */
  @Roles('salon_owner')
  @Post('me/specialists')
  @ApiOperation({ summary: 'افزودن متخصص' })
  createSpecialist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSpecialistPanelDto,
  ): Promise<SalonPanelSpecialistCreated> {
    return this.salons.createPanelSpecialist(user, dto);
  }

  /** Edit a specialist's bio/skills/commission or toggle their visibility. */
  @Roles('salon_owner')
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
  @Roles('salon_owner')
  @Delete('me/specialists/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف متخصص' })
  deleteSpecialist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.deletePanelSpecialist(user, id);
  }
  /**
   * The services the salon assigned to one specialist. A specialist token may
   * only ask for its own row (the service answers 403 for any other id); the
   * owner and line manager see every specialist of the salon.
   */
  @Roles('salon_owner', 'line_manager', 'specialist')
  @Get('me/specialists/:id/services')
  @ApiOperation({ summary: 'خدمات اختصاص‌داده‌شده به یک متخصص' })
  listSpecialistServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonSpecialistServiceItem[]> {
    return this.salons.listPanelSpecialistServices(user, id);
  }

  /**
   * Replaces the set of services a specialist offers. Only the salon owner (or
   * a platform admin acting on the salon) may define it: the catalogue of a
   * specialist is the salon's decision, not the provider's. Services that do
   * not belong to the salon answer 400, so another salon's id is never
   * silently accepted.
   */
  @Roles('salon_owner', 'admin')
  @Put('me/specialists/:id/services')
  @ApiOperation({ summary: 'تعریف خدمات یک متخصص (جایگزینی کل لیست)' })
  setSpecialistServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSpecialistServicesDto,
  ): Promise<SalonSpecialistServiceItem[]> {
    return this.salons.setPanelSpecialistServices(user, id, dto);
  }


  /** Portfolio photos of the salon's specialists, inactive ones included. */
  @Roles('salon_owner')
  @Get('me/portfolio')
  @ApiOperation({ summary: 'نمونه‌کارهای سالن کاربر واردشده' })
  listPortfolio(@CurrentUser() user: AuthenticatedUser): Promise<SalonPanelPortfolio> {
    return this.salons.listPanelPortfolio(user);
  }

  /** Add a portfolio photo; the tenant goes to pending approval. */
  @Roles('salon_owner')
  @Post('me/portfolio')
  @ApiOperation({ summary: 'افزودن نمونه‌کار (نیازمند تایید ادمین)' })
  addPortfolioItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPortfolioItemDto,
  ): Promise<SalonPanelWriteResult> {
    return this.salons.addPanelPortfolioItem(user, dto);
  }

  /** Delete a portfolio photo; the tenant goes to pending approval. */
  @Roles('salon_owner')
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
  @Roles('salon_owner', 'specialist')
  @Get('me/bookings')
  @ApiOperation({ summary: 'لیست رزروهای سالن کاربر واردشده' })
  listBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalonPanelBookingsQueryDto,
  ): Promise<SalonPanelBookingPage> {
    return this.salons.listPanelBookings(user, query);
  }

  /** One booking of the signed-in salon, with the working hours to judge it against. */
  @Roles('salon_owner', 'specialist')
  @Get('me/bookings/:id')
  @ApiOperation({ summary: 'جزئیات یک رزرو' })
  getBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelBookingDetail> {
    return this.salons.getPanelBooking(user, id);
  }

  /** Confirm a pending booking; the customer is notified. */
  @Roles('salon_owner', 'specialist')
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
  @Roles('salon_owner', 'specialist')
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
  @Roles('salon_owner', 'specialist')
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
  @Roles('salon_owner', 'specialist')
  @Post('me/bookings/:id/no-show')
  @ApiOperation({ summary: 'ثبت عدم مراجعه' })
  noShowBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalonPanelBookingDetail> {
    return this.salons.noShowPanelBooking(user, id);
  }

  /** Today/week snapshot of the signed-in staff user's salon. */
  @Roles('salon_owner')
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

  @Get('customer/mobile-specialists')
  @ApiOperation({ summary: 'لیست متخصصان سیار' })
  async getMobileSpecialists(): Promise<MobileSpecialistDto[]> {
    return this.salons.getMobileSpecialists();
  }
}

