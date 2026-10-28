import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { setTenantContext, setUserContext } from '../../database/tenant-context';

import {
  endOfTehranWeek,
  startOfTehranDay,
  startOfTehranWeek,
} from '../../utils/jalali-date.util';
import {
  DEFAULT_SLOT_STEP_MINUTES,
  dayKeyForCivilDate,
  dayKeyForInstant,
  dayWindow,
  formatClock,
  minutesSinceMidnight,
  slotStarts,
  withinWindow,
} from '../../utils/working-hours.util';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { ApprovalStatus } from '../../common/approval-status';
import {
  BOOKING_CANCELLED,
  BOOKING_CONFIRMED,
  BookingCancelledEvent,
  BookingConfirmedEvent,
} from '../../common/domain-events';
import {
  AddPortfolioItemDto,
  CreateSpecialistPanelDto,
  UpdateSpecialistPanelDto,
} from './dto/specialist-panel.dto';
import { SetSpecialistServicesDto } from './dto/specialist-services.dto';
import {
  CreateServiceDto,
  CreateServiceLineDto,
  UpdateServiceDto,
  UpdateServiceLineDto,
} from './dto/update-service-line.dto';
import { MatchSalonsDto } from './dto/match-salons.dto';
import { CreateScheduleBlockDto } from './dto/salon-schedule-block.dto';
import { SalonAvailabilityQueryDto } from './dto/salon-availability-query.dto';
import {
  SalonBookingStatus,
  SalonPanelBookingsQueryDto,
  SalonPanelRejectBookingDto,
} from './dto/salon-bookings-query.dto';
import { SalonQueryDto, SalonSort } from './dto/salon-query.dto';
import { UpdateSalonProfileDto } from './dto/update-salon-profile.dto';
import { UpdateSalonScheduleDto } from './dto/update-salon-schedule.dto';

const TAG_LIMIT = 3;
const MAX_LIMIT = 50;

/** Reply of both approval-gated salon writes. */
const PENDING_APPROVAL_MESSAGE = 'ط¯ط± ط§ظ†طھط¸ط§ط± طھط§غŒغŒط¯ ط§ط¯ظ…غŒظ†';

/**
 * Rows an `UPDATE`/`DELETE` touched, as [PostgresQueryRunner] returns them.
 *
 * `manager.query()` hands back the raw driver tuple `[rows, rowCount]` for those
 * two commands — the count is the *second element itself*, a bare number, not
 * an object carrying `rowCount`. Reading `result[1].rowCount` therefore yields
 * `undefined` for every statement, which never equals 1, so every transition
 * reported a conflict even though the `UPDATE` had already been issued (the
 * throw then rolled it back, leaving the caller's booking unchanged while the
 * response said "already reviewed").
 *
 * Returns `undefined` for any other shape, so a `SELECT` can never be counted
 * as a write by accident.
 */
function affectedRows(result: unknown): number | undefined {
  if (!Array.isArray(result)) return undefined;
  const count = result[1];
  return typeof count === 'number' ? count : undefined;
}


/**
 * The public-catalogue predicate for a tenant, with the `t` alias.
 *
 * This is deliberately NOT `status = 'approved'`. A single `status` column
 * carries two different ideas at once â€” "is this entity live" and "is there an
 * edit waiting for review" â€” and conflating them makes the catalogue unusable:
 * a salon that merely corrected a typo in its phone number would drop out of
 * search the instant it submitted the change, and every salon awaiting its
 * *first* approval would look identical to one mid-edit.
 *
 * `approved_at IS NOT NULL` is the "has ever been approved" flag, which is what
 * public visibility actually depends on, and it separates the two cases:
 *
 *  - new salon, first approval pending  -> approved_at NULL   -> hidden
 *  - live salon, edit pending review     -> approved_at set   -> visible, old data
 *  - edit rejected                      -> approved_at set   -> visible, old data
 *  - suspended                          -> approved_at set   -> hidden by the second clause
 *
 * A rejected *edit* must therefore leave `approved_at` alone; clearing it (as an
 * earlier draft did) would silently un-publish a salon that had been serving
 * customers all along.
 */
const PUBLIC_SALON_SQL = "t.approved_at IS NOT NULL AND t.status <> 'suspended'";

/** The same predicate for the queries that do not alias `tenants`. */
const PUBLIC_TENANT_SQL = "approved_at IS NOT NULL AND status <> 'suspended'";

export interface SalonListItem {
  id: string;
  name: string;
  /** Category name, e.g. ط±ظ†ع¯ ظˆ ظ‡ط§غŒظ„ط§غŒطھ â€” the card's second line. */
  specialty: string;
  coverImage: string | null;
  address: string | null;
  rating: number;
  reviewCount: number;
  /** `null` when the caller sent no coordinates or the salon has none. */
  distanceKm: number | null;
  discountPercent: number | null;
  minPrice: number | null;
  tags: string[];
  isOpenNow: boolean;
}

export interface SalonPage {
  data: SalonListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SalonCategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  /** Glyph the home grid renders, e.g. ًںژ¨. */
  emoji: string;
  sortOrder: number;
}

export interface SalonCatalogServiceItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  /** ADR-011: can this service be delivered away from the salon? */
  isMobileAvailable: boolean;
}

/** One active specialist of a salon, as shown on the booking form. */
export interface SalonSpecialist {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  skills: string[];
  commissionRate: number;
  /** ADR-011: does this specialist travel to the customer? */
  offersMobileService: boolean;
}

/** Response of `GET /salons/:id/specialists`. */
export interface SalonSpecialists {
  data: SalonSpecialist[];
}

/** Response of `GET /salons/:id/services`. */
export interface SalonCatalogServices {
  data: SalonCatalogServiceItem[];
}

/** One portfolio photo of one specialist, from `GET /salons/:id/portfolio`. */
export interface SalonPortfolioItem {
  id: string;
  imageUrl: string;
  specialistId: string;
  specialistName: string | null;
}

/** Response of `GET /salons/:id/portfolio`. */
export interface SalonPortfolio {
  data: SalonPortfolioItem[];
}

export interface SalonDetail extends SalonListItem {
  nameEn: string | null;
  slug: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  /** `cities.id` / `provinces.id`, null when the salon has not picked one. */
  cityId: string | null;
  provinceId: string | null;
  workingHours: Record<string, unknown>;
  settings: Record<string, unknown>;
  services: SalonCatalogServiceItem[];
  specialists: SalonSpecialist[];
  /** Portfolio photos of the salon's active specialists â€” the آ«ظ†ظ…ظˆظ†ظ‡â€Œع©ط§ط±ظ‡ط§آ» tab. */
  portfolio: SalonPortfolioItem[];
}

/** One time range of `GET /salons/:id/available-slots`. */
export interface SalonAvailabilitySlot {
  /** Tehran wall clock, `HH:MM`. */
  start: string;
  end: string;
  /** False when a live booking already covers the range. */
  available: boolean;
}

export interface SalonAvailability {
  data: SalonAvailabilitySlot[];
}

/**
 * One blocked range of the schedule (`schedule_blocks`).
 *
 * `salonId` is NULL when the block belongs to a salon-independent
 * `freelance_mobile` specialist, whose calendar hangs off their
 * `specialists` row instead of a tenant.
 */
export interface SalonScheduleBlockItem {
  id: string;
  /** NULL = the whole salon is blocked, not one specialist. */
  specialistId: string | null;
  /** NULL = a mobile specialist's block, not a salon's. */
  salonId: string | null;
  /** Gregorian `YYYY-MM-DD` of `startTime`; the panel shows Jalali. */
  date: string;
  startTime: Date;
  endTime: Date;
  reason: string | null;
}

/** Response of `GET /salon/me/schedule/blocks`. */
export interface SalonScheduleBlockList {
  data: SalonScheduleBlockItem[];
}

/** Response of `GET /salon/me`, the signed-in staff user's own salon. */
export interface SalonStaffProfile {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  coverImage: string | null;
  status: 'active' | 'inactive';
  rating: number;
  reviewCount: number;
  workingHours: Record<string, unknown>;
  specialistsCount: number;
  servicesCount: number;
  /**
   * False while the owner still has to run through the onboarding form
   * (`tenants.profile_completed`, migration 1730000000033). The salon app
   * reads this to decide whether to route into `SalonProfileSetupScreen`
   * instead of the dashboard; it is independent of `status` (moderation).
   */
  profileCompleted: boolean;
}

/** Approval lifecycle of a tenant, mirroring the `approval_status` enum. */
export type SalonApprovalState = ApprovalStatus;

/** Response of `GET /salon/me/status`. */
export interface SalonApprovalStatus {
  status: SalonApprovalState;
  /** Set only while `status === 'rejected'`; shown to the salon owner. */
  rejectionReason: string | null;
  /** True when an edit is waiting for an admin decision. */
  hasPendingChanges: boolean;
}

/**
 * Response of the two approval-gated writes, `PATCH /salon/me` and
 * `PATCH /salon/me/schedule`.
 */
export interface SalonPendingUpdate {
  status: 'pending_approval';
  message: string;
}

/** One service line of the signed-in salon, for the panel listing. */
export interface SalonServiceLineItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  status: ApprovalStatus;
  servicesCount: number;
  createdAt: string;
}

/** One service under a service line, for the panel listing. */
export interface SalonServiceItem {
  id: string;
  lineId: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  depositRequired: boolean;
  depositAmount: number | null;
  isActive: boolean;
  /** ADR-011: can this service leave the salon? */
  isMobileAvailable: boolean;
  createdAt: string;
}

/** The settled state of a line/service write, returned to the panel. */
export interface SalonPanelWriteResult {
  status: ApprovalStatus;
  message: string;
}

/** One specialist row of the panel listing (`GET /salon/me/specialists`). */
export interface SalonPanelSpecialistItem {
  id: string;
  userId: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  skills: string[];
  commissionRate: number;
  isActive: boolean;
  /** ADR-011: does this specialist travel to the customer? */
  offersMobileService: boolean;
  bookingsCount: number;
}

/**
 * Reply of `POST /salon/me/specialists`. Carries the row identity back
 * because the specialist itself is created `approved` â€” there is nothing to
 * poll for, the id is all the caller needs to open the edit form.
 */
export interface SalonPanelSpecialistCreated {
  id: string;
  fullName: string;
  phone: string;
  status: ApprovalStatus;
}

/**
 * One service assigned to a specialist (`specialist_services`, migration
 * 1792900000000). Returned by both the panel read and the public read; the
 * fields the customer app's service card needs are exactly the ones the salon
 * owner defined, never the full salon catalogue.
 */
export interface SalonSpecialistServiceItem {
  id: string;
  specialistId: string;
  serviceId: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  /** Off switch the owner can flip without un-assigning the service. */
  isActive: boolean;
  /** ADR-011: can this service leave the salon? */
  isMobileAvailable: boolean;
}

/** Response of `GET /salons/:id/specialists/:specialistId/services`. */
export interface SalonSpecialistServices {
  data: SalonSpecialistServiceItem[];
}


export interface SalonPanelBookingItem {
  id: string;
  status: string;
  /** Beginning of the reserved range, ISO 8601 UTC. */
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  depositPaid: number;
  notes: string | null;
  createdAt: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  specialistId: string;
  specialistName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  lineId: string | null;
  /** ADR-011: the customer asked for an on-site visit. */
  isMobile: boolean;
  /** ADR-011: where the specialist travels to when `isMobile`. */
  customerAddress: string | null;
  /** ADR-011: `numeric` over the wire, so the client parses it. */
  customerLatitude: string | number | null;
  customerLongitude: string | number | null;
}
/** One portfolio photo of the panel listing (`GET /salon/me/portfolio`). */
export interface SalonPanelPortfolioItem {
  id: string;
  imageUrl: string;
  specialistId: string;
  specialistName: string | null;
  createdAt: string;
}

/** Per-status totals behind the list screen's filter tabs. */
export interface SalonBookingCounts {
  pending: number;
  confirmed: number;
  completed: number;
  reviewed: number;
  cancelled: number;
  noShow: number;
}

/** Response of `GET /salon/me/bookings`. */
export interface SalonPanelBookingPage {
  data: SalonPanelBookingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: SalonBookingCounts;
}

/**
 * Response of `GET /salon/me/bookings/:id` and of the four action endpoints.
 * The actions answer with the refreshed detail rather than a bare status so the
 * screen never has to guess what the row looks like after the transition.
 */
export interface SalonPanelBookingDetail extends SalonPanelBookingItem {
  workingHours: Record<string, unknown>;
  settings: Record<string, unknown>;
}

/** Response of `GET /salon/me/portfolio`. */
export interface SalonPanelPortfolio {
  data: SalonPanelPortfolioItem[];
}

/** One bar of the dashboard's weekly chart: Saturday is 0, Friday is 6. */
export interface SalonDashboardDayRevenue {
  dayIndex: number;
  amount: number;
}

/** One row of the dashboard's `topSpecialists`. */
export interface SalonDashboardTopSpecialist {
  id: string;
  fullName: string | null;
  bookings: number;
  revenue: number;
}

/** Response of `GET /salon/dashboard`. */
export interface SalonDashboardPayload {
  todayBookings: number;
  todayRevenue: number;
  weekBookings: number;
  weekRevenue: number;
  pendingBookings: number;
  weeklyRevenue: SalonDashboardDayRevenue[];
  topSpecialists: SalonDashboardTopSpecialist[];
}

/** Raw shape of `GET /salon/me`; Postgres decimals arrive as strings. */
interface SalonStaffRow {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  rating: string | null;
  review_count: number | null;
  working_hours: Record<string, unknown> | null;
  specialists_count: number;
  services_count: number;
  profile_completed: boolean;
}

/** Raw shape of the dashboard aggregates. */
interface SalonDashboardAggregateRow {
  bookings: number;
  revenue: string;
}

/** Raw shape of the dashboard's per-day split. */
interface SalonDashboardDayRow {
  day_index: number;
  amount: string;
}

/** Raw shape of the dashboard's top-specialists rows. */
interface SalonDashboardSpecialistRow {
  id: string;
  full_name: string | null;
  bookings: number;
  revenue: string;
}

/** Raw shape of the listing/detail SELECT; Postgres decimals arrive as strings. */
interface SalonRow {
  id: string;
  name: string;
  name_en: string | null;
  slug: string | null;
  address: string | null;
  phone: string | null;
  cover_image_url: string | null;
  category_name: string | null;
  rating: string | null;
  review_count: number | null;
  distance_km: string | null;
  discount_percent: number | null;
  min_price: string | null;
  working_hours: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  latitude: string | null;
  longitude: string | null;
  /** Location links (migration 1730000000038); null when the salon never picked one. */
  city_id: string | null;
  province_id: string | null;
}

/** Raw shape of the panel's service-line list; decimals arrive as strings. */
interface SalonServiceLineRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  status: ApprovalStatus;
  services_count: number;
  created_at: Date;
}

/** Raw shape of the panel's service list; decimals arrive as strings. */
interface SalonServiceRow {
  id: string;
  line_id: string;
  name: string;
  description: string | null;
  price: string;
  duration_minutes: number;
  deposit_required: boolean;
  deposit_amount: string | null;
  is_active: boolean;
  is_mobile_available: boolean;
  created_at: Date;
}

const toNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Read-only catalogue of active salons. Everything here is public data, and the
 * queries list columns explicitly instead of `SELECT *` so a future tenant
 * column cannot leak through this endpoint.
 */
@Injectable()
export class SalonService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly cache: CacheService,
  ) {}

  private async invalidateSpecialistCache(tenantId: string): Promise<void> {
    await this.cache.invalidateTenantCache(tenantId);
  }

  async list(query: SalonQueryDto): Promise<SalonPage> {
    const page = Math.max(Math.trunc(query.page) || 1, 1);
    const limit = Math.min(Math.max(Math.trunc(query.limit) || 20, 1), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const categorySlug = query.category ?? query.categorySlug;
    const sort = query.sort ?? SalonSort.Rating;
    const coords =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : undefined;

    const params: unknown[] = [];
    const bind = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // A salon is listed once it has been approved at least once and is not
    // suspended; see PUBLIC_SALON_SQL for why `status` alone is not the test.
    const where: string[] = ['t.is_active = true', PUBLIC_SALON_SQL];
    if (categorySlug) where.push(`c.slug = ${bind(categorySlug)}`);

    // `?mobile=true` (ADR-011): a salon qualifies only while it has *both* a
    // travelling specialist and a travel-capable service. Either alone is
    // useless to a customer booking on-site, so the filter is the conjunction.
    // No bound parameters, so it lands in the shared `whereSql` that the count
    // query reuses as-is.
    if (query.mobile) {
      where.push(
        `EXISTS (
           SELECT 1 FROM specialists s
           WHERE s.tenant_id = t.id
             AND s.offers_mobile_service = true
             AND s.is_active = true
         )`,
      );
      where.push(
        `EXISTS (
           SELECT 1 FROM services sv
           WHERE sv.tenant_id = t.id
             AND sv.is_mobile_available = true
             AND sv.is_active = true
         )`,
      );
    }

    // `?cityId=` / `?provinceId=`: the Home screen's city picker. Both columns
    // are nullable and plain equality is enough — a salon with no city set can
    // never match either filter, which is the intent. Bound here rather than
    // inlined so they reach the count query's `whereParams` snapshot below.
    if (query.cityId) where.push(`t.city_id = ${bind(query.cityId)}`);
    if (query.provinceId) where.push(`t.province_id = ${bind(query.provinceId)}`);

    // The count query is a separate statement that only needs the filters, and
    // those are bound first, so its placeholders still line up.
    const whereParams = [...params];
    const whereSql = where.join(' AND ');

    // Haversine in plain SQL: PostGIS is not installed. The acos() argument is
    // clamped to [-1, 1] because rounding error makes it NaN for identical
    // coordinates.
    const distanceSelect = this.buildDistanceSelect(coords, bind);

    const orderByMap: Record<SalonSort, string> = {
      [SalonSort.Distance]:
        'distance_km NULLS LAST, t.rating DESC, t.review_count DESC, t.id',
      [SalonSort.Rating]: 't.rating DESC, t.review_count DESC, t.id',
      [SalonSort.Price]: 'min_price NULLS LAST, t.rating DESC, t.id',
      [SalonSort.Newest]: 't.created_at DESC, t.id',
    };
    // Distance needs a reference point; without one the feed stays on ratings.
    const orderBy =
      sort === SalonSort.Distance && !coords
        ? orderByMap[SalonSort.Rating]
        : orderByMap[sort];

    const rows = await this.dataSource.query<SalonRow[]>(
      `WITH price_agg AS (
         SELECT s.tenant_id, MIN(s.price) AS min_price
         FROM services s
         GROUP BY s.tenant_id
       )
       SELECT t.id, t.name, t.name_en, t.slug, t.address, t.phone, t.cover_image_url,
              t.discount_percent,
              c.name AS category_name, t.rating, t.review_count,
              t.working_hours, t.settings, t.latitude, t.longitude,
              pa.min_price,
              ${distanceSelect}
       FROM tenants t
       LEFT JOIN price_agg pa ON pa.tenant_id = t.id
       LEFT JOIN service_categories c ON c.id = t.category_id
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ${bind(limit)} OFFSET ${bind(offset)}`,
      params,
    );

    const [countRow] = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total
       FROM tenants t
       LEFT JOIN service_categories c ON c.id = t.category_id
       WHERE ${whereSql}`,
      whereParams,
    );

    const total = countRow?.total ?? 0;
    const tags = await this.loadTags(rows.map((row) => row.id));
    const now = new Date();

    return {
      data: rows.map((row) => this.toListItem(row, tags.get(row.id) ?? [], now)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Weighted multi-criteria match, the foundation of the "best match" feature.
   *
   * Each criterion is normalised to 0â€“1 across the result set before the
   * weights are applied, so a weight means "share of importance" rather than
   * "absolute scale". Distance and price are inverted because lower is better.
   *
   * Phase 2 will multiply this score by a premium boost; nothing here reads
   * the subscription columns, which stay unused until then.
   */
  async match(dto: MatchSalonsDto): Promise<SalonPage & { weights: NormalisedWeights }> {
    const requested = dto.limit ?? 20;
    const limit = Math.min(Math.max(Math.trunc(requested) || 20, 1), MAX_LIMIT);
    const params: unknown[] = [];
    const bind = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const weights = normaliseWeights(dto.sortWeights ?? dto.weights);
    const coords =
      dto.lat !== undefined && dto.lng !== undefined ? { lat: dto.lat, lng: dto.lng } : undefined;

    const where: string[] = ['t.is_active = true', PUBLIC_SALON_SQL];
    if (dto.categorySlug) where.push(`c.slug = ${bind(dto.categorySlug)}`);
    if (dto.minRating !== undefined) where.push(`t.rating >= ${bind(dto.minRating)}`);
    if (dto.onlyDiscounted) where.push(`t.discount_percent IS NOT NULL AND t.discount_percent > 0`);

    // distance_km and pa.min_price are SELECT aliases, and PostgreSQL does not
    // allow an alias in WHERE, so the range filters run on the outer query.
    const outer: string[] = [];
    if (dto.maxDistanceKm !== undefined) {
      outer.push(`distance_km IS NOT NULL AND distance_km <= ${bind(dto.maxDistanceKm)}`);
    }
    if (dto.maxPrice !== undefined) {
      outer.push(`min_price IS NOT NULL AND min_price <= ${bind(dto.maxPrice)}`);
    }

    const rows = await this.dataSource.query<SalonRow[]>(
      `SELECT * FROM (
         WITH price_agg AS (
           SELECT s.tenant_id, MIN(s.price) AS min_price
           FROM services s
           GROUP BY s.tenant_id
         )
         SELECT t.id, t.name, t.name_en, t.slug, t.address, t.phone, t.cover_image_url,
                t.discount_percent,
                c.name AS category_name, t.rating, t.review_count,
                t.working_hours, t.settings, t.latitude, t.longitude,
                pa.min_price,
                ${this.buildDistanceSelect(coords, bind)}
         FROM tenants t
         LEFT JOIN price_agg pa ON pa.tenant_id = t.id
         LEFT JOIN service_categories c ON c.id = t.category_id
         WHERE ${where.join(' AND ')}
       ) matched
       ${outer.length ? `WHERE ${outer.join(' AND ')}` : ''}`,
      params,
    );

    const tags = await this.loadTags(rows.map((row) => row.id));
    const now = new Date();
    const items = rows.map((row) => this.toListItem(row, tags.get(row.id) ?? [], now));
    const scored = sortByWeightedScore(items, weights).slice(0, limit);

    return {
      data: scored,
      total: scored.length,
      page: 1,
      limit,
      totalPages: 1,
      weights,
    };
  }

  async listCategories(): Promise<{ data: SalonCategoryItem[] }> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        slug: string;
        icon: string | null;
        emoji: string;
        sort_order: number;
      }>
    >(
      `SELECT id, name, slug, icon, emoji, sort_order
       FROM service_categories
       WHERE is_active = true
       ORDER BY sort_order, name`,
    );

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        icon: row.icon,
        emoji: row.emoji,
        sortOrder: row.sort_order,
      })),
    };
  }

  async findOne(id: string, query: SalonQueryDto): Promise<SalonDetail> {
    const params: unknown[] = [id];
    const bind = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const coords =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : undefined;

    const [row] = await this.dataSource.query<SalonRow[]>(
      `SELECT t.id, t.name, t.name_en, t.slug, t.address, t.phone, t.cover_image_url,
              t.discount_percent,
              c.name AS category_name, t.rating, t.review_count,
              t.working_hours, t.settings, t.latitude, t.longitude,
              t.city_id, t.province_id,
              (SELECT MIN(s.price) FROM services s WHERE s.tenant_id = t.id) AS min_price,
              ${this.buildDistanceSelect(coords, bind)}
       FROM tenants t
       LEFT JOIN service_categories c ON c.id = t.category_id
       WHERE t.id = $1 AND t.is_active = true AND ${PUBLIC_SALON_SQL}`,
      params,
    );
    if (!row) throw new NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

    // Four independent reads, issued together: the detail page waits on the
    // slowest round trip instead of the sum of four.
    const [serviceRows, tags, specialists, portfolio] = await Promise.all([
      this.dataSource.query<
        Array<{
          id: string;
          name: string;
          description: string | null;
          price: string;
          is_mobile_available: boolean;
        }>
      >(
        `SELECT id, name, description, price, is_mobile_available
         FROM services
         WHERE tenant_id = $1
         ORDER BY price ASC, name ASC`,
        [id],
      ),
      this.loadTags([id]),
      this.loadSpecialists(id),
      this.loadPortfolio(id),
    ]);
    const now = new Date();

    return {
      ...this.toListItem(row, tags.get(id) ?? [], now),
      nameEn: row.name_en,
      slug: row.slug,
      phone: row.phone,
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
      cityId: row.city_id,
      provinceId: row.province_id,
      workingHours: row.working_hours ?? {},
      settings: row.settings ?? {},
      services: serviceRows.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: toNumber(service.price) ?? 0,
        isMobileAvailable: service.is_mobile_available === true,
      })),
      specialists,
      portfolio,
    };
  }

  /**
   * Active specialists of one salon, for the booking form's specialist picker.
   * With `mobile`, only the ones who travel to the customer (ADR-011).
   */
  async specialists(id: string, mobile?: boolean): Promise<SalonSpecialists> {
    const [tenant] = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`,
      [id],
    );
    if (!tenant) throw new NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

    const specialists = await this.loadSpecialists(id);

    // Filtered in memory rather than in SQL: the flag comes from a second round
    // trip off `specialists` (see loadSpecialists), so there is no single
    // statement to hang a WHERE on.
    return { data: mobile === true ? specialists.filter((s) => s.offersMobileService) : specialists };
  }

  /**
   * Services of one salon, for the booking form's service picker. With `mobile`,
   * only the ones that can be delivered away from the salon (ADR-011).
   */
  async services(id: string, mobile?: boolean): Promise<SalonCatalogServices> {
    const [tenant] = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`,
      [id],
    );
    if (!tenant) throw new NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

    const serviceRows = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        description: string | null;
        price: string;
        is_mobile_available: boolean;
      }>
    >(
      `SELECT id, name, description, price, is_mobile_available
       FROM services
       WHERE tenant_id = $1 AND is_active = true
       ${mobile ? 'AND is_mobile_available = true' : ''}
       ORDER BY price ASC, name ASC`,
      [id],
    );

    return {
      data: serviceRows.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: toNumber(service.price) ?? 0,
        isMobileAvailable: service.is_mobile_available === true,
      })),
    };
  }

  /**
   * `GET /salons/:id/specialists/:specialistId/services` — the services the
   * salon assigned to one specialist, the only list the booking form's service
   * picker may show once a specialist is picked. The whole salon catalogue is
   * NOT returned here.
   *
   * Read through `get_public_specialist_services()` because
   * `specialist_services` is FORCE ROW LEVEL SECURITY on
   * `app.current_tenant_id` and a public request sets no GUC — the same escape
   * hatch the other public lookups (1730000000015/16) already use.
   *
   * An empty reply means "nothing assigned yet" only when the specialist is
   * active in this salon; otherwise the request is a 404 so a stale id cannot
   * be probed through this route.
   */
  async specialistServices(
    salonId: string,
    specialistId: string,
  ): Promise<SalonSpecialistServices> {
    const [tenant] = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`,
      [salonId],
    );
    if (!tenant) throw new NotFoundException('سالن مورد نظر یافت نشد');

    const rows = await this.dataSource.query<
      Array<{
        service_id: string;
        name: string;
        description: string | null;
        price: string;
        duration_minutes: number;
        is_mobile_available: boolean;
      }>
    >(
      `SELECT service_id, name, description, price, duration_minutes, is_mobile_available
         FROM get_public_specialist_services($1::uuid, $2::uuid)`,
      [salonId, specialistId],
    );

    if (rows.length === 0) {
      const [specialist] = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM specialists WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
        [specialistId, salonId],
      );
      if (!specialist) throw new NotFoundException('متخصص مورد نظر یافت نشد');
    }

    return {
      data: rows.map((row) => ({
        id: `${row.service_id}:${specialistId}`,
        specialistId,
        serviceId: row.service_id,
        name: row.name,
        description: row.description,
        price: toNumber(row.price) ?? 0,
        durationMinutes: row.duration_minutes ?? 0,
        isActive: true,
        isMobileAvailable: row.is_mobile_available === true,
      })),
    };
  }

  /**
   * Every portfolio photo of every active specialist of one salon â€” the
   * آ«ظ†ظ…ظˆظ†ظ‡â€Œع©ط§ط±ظ‡ط§آ» tab of the salon detail page.
   *
   * Read through get_public_salon_portfolio(), which does the jsonb expansion
   * and the join to `users` inside a SECURITY DEFINER function: `users` is
   * FORCE ROW LEVEL SECURITY and this route has no tenant context, so a plain
   * join would come back with empty specialist names (same reason as
   * `loadSpecialists` below).
   *
   * Each element of `specialists.portfolio_images` is either a bare URL string
   * (`["https://â€¦"]`) or an object (`[{"url": "https://â€¦"}]`). Both shapes are
   * accepted, because the column is free-form JSONB and the salon app does not
   * write it yet. `id` is the image's own id when the object carries one
   * (`id`/`imageId`), otherwise a key derived from the specialist and the image
   * index, so the client always has something stable to key a grid tile and a
   * photo viewer page on.
   *
   * An unknown salon is a 404; a salon with no photos is `{ "data": [] }`.
   */
  async portfolio(id: string): Promise<SalonPortfolio> {
    const [tenant] = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`,
      [id],
    );
    if (!tenant) throw new NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

    return { data: await this.loadPortfolio(id) };
  }

  /**
   * The portfolio SELECT behind both `findOne` (which embeds it as
   * `portfolio`) and `portfolio()`. Split out so the detail endpoint answers
   * in one call instead of re-reading the tenant first.
   */
  private async loadPortfolio(salonId: string): Promise<SalonPortfolioItem[]> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        image_url: string;
        specialist_id: string;
        specialist_name: string | null;
      }>
    >(
      `SELECT id, image_url, specialist_id, specialist_name
       FROM get_public_salon_portfolio($1::uuid)`,
      [salonId],
    );

    return rows.map((row) => ({
      id: row.id,
      imageUrl: row.image_url,
      specialistId: row.specialist_id,
      specialistName: row.specialist_name,
    }));
  }

  /** Great-circle distance in km, or a NULL column when no reference point. */
  private buildDistanceSelect(
    coords: { lat: number; lng: number } | undefined,
    bind: (value: unknown) => string,
  ): string {
    if (!coords) return 'NULL::numeric AS distance_km';

    const latPh = bind(coords.lat);
    const lngPh = bind(coords.lng);
    // Plain SQL Haversine: PostGIS is not installed. The acos() argument is
    // clamped to [-1, 1] because rounding error makes it NaN when the salon
    // sits exactly on the caller's coordinates.
    const haversine =
      `6371 * acos(LEAST(1, GREATEST(-1, ` +
      `COS(RADIANS(${latPh})) * COS(RADIANS(t.latitude))` +
      ` * COS(RADIANS(t.longitude) - RADIANS(${lngPh}))` +
      ` + SIN(RADIANS(${latPh})) * SIN(RADIANS(t.latitude)))))`;

    return (
      `CASE WHEN t.latitude IS NOT NULL AND t.longitude IS NOT NULL ` +
      `THEN ROUND((${haversine})::numeric, 1) END AS distance_km`
    );
  }

  /**
   * Free time ranges of a salon for one day and one service.
   *
   * Public, because the customer app shows the times before anyone signs in.
   * Three inputs decide the answer: the salon's `working_hours`, the duration of
   * the chosen service, and the bookings that already exist. A day the schedule
   * has no open window for â€” Friday is the default weekend, and a salon that
   * configured nothing at all has no open window either â€” yields an empty list.
   *
   * The overlap test runs in SQL with `&&` over `time_slot`, the operator the
   * `no_overlapping_bookings` exclusion constraint is built from, so a slot is
   * judged by exactly the predicate that will reject a duplicate INSERT later.
   * PostgreSQL also turns the Tehran wall-clock boundaries into instants
   * (`AT TIME ZONE 'Asia/Tehran'`) and formats nothing itself: the `HH:MM`
   * labels come from the minute numbers, which keeps the day's arithmetic off
   * the host clock.
   */
  async availableSlots(
    id: string,
    query: SalonAvailabilityQueryDto,
  ): Promise<SalonAvailability> {
    const date = parseCivilDate(query.date);

    const [tenant] = await this.dataSource.query<
      Array<{ working_hours: Record<string, unknown> | null }>
    >(`SELECT working_hours FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`, [id]);
    if (!tenant) throw new NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

    const [service] = await this.dataSource.query<Array<{ duration_minutes: number }>>(
      `SELECT duration_minutes
       FROM services
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [query.serviceId, id],
    );
    if (!service) throw new NotFoundException('ط®ط¯ظ…طھ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

    if (query.specialistId) {
      const [specialist] = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM specialists WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
        [query.specialistId, id],
      );
      if (!specialist) throw new NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
    }

    const window = dayWindow(tenant.working_hours, dayKeyForCivilDate(date));
    const durationMinutes = service.duration_minutes;
    const starts = window ? slotStarts(window, durationMinutes, DEFAULT_SLOT_STEP_MINUTES) : [];
    if (starts.length === 0) return { data: [] };

    const rows = await this.withTenant(id, (manager) =>
      manager.query<Array<{ start_minute: number; busy: boolean }>>(
        `WITH candidate AS (
           SELECT t.minute AS start_minute,
                  (($1::date)::timestamp + make_interval(mins => t.minute)) AT TIME ZONE 'Asia/Tehran' AS slot_start,
                  (($1::date)::timestamp + make_interval(mins => t.minute + $2::int)) AT TIME ZONE 'Asia/Tehran' AS slot_end
           FROM unnest($3::int[]) AS t(minute)
         )
         SELECT c.start_minute,
                EXISTS (
                  SELECT 1
                  FROM bookings b
                  WHERE b.status NOT IN ('cancelled', 'no_show')
                    AND b.time_slot && tstzrange(c.slot_start, c.slot_end, '[)')
                    AND ($4::uuid IS NULL OR b.specialist_id = $4::uuid)
                )
                -- A blocked range occupies a slot exactly like a booking would:
                -- the whole-salon block (specialist_id IS NULL) counts for
                -- every specialist, a specialist block only for that one.
                OR EXISTS (
                  SELECT 1
                  FROM schedule_blocks sb
                  WHERE tstzrange(sb.start_time, sb.end_time, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
                    AND ($4::uuid IS NULL OR sb.specialist_id IS NULL OR sb.specialist_id = $4::uuid)
                ) AS busy
         FROM candidate c
         ORDER BY c.start_minute`,
        // Tenant scoping is the RLS setting, so the tenant id is not a parameter
        // here: PostgreSQL cannot infer the type of a placeholder it never sees.
        [query.date, durationMinutes, starts, query.specialistId ?? null],
      ),
    );

    return {
      data: rows.map((row) => ({
        start: formatClock(row.start_minute),
        end: formatClock(row.start_minute + durationMinutes),
        available: !row.busy,
      })),
    };
  }

  /**
   * Runs a read that has to see a tenant's rows on a route that has no tenant
   * context of its own.
   *
   * `bookings` is FORCE ROW LEVEL SECURITY on `current_setting('app.current_tenant_id')`,
   * so without this a public request would be filtered to zero rows and every
   * slot would look free. The setting is transaction-local (`set_config(..., true)`),
   * which keeps it off the pooled connection â€” the same pattern
   * `BookingService.create` uses for its INSERT.
   */
  private withTenant<T>(
    tenantId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await setTenantContext(manager, tenantId);
      return work(manager);
    });
  }

  /**
   * Same shape as [withTenant] for panel endpoints.
   * All tenant policies read `app.current_tenant_id` (see setTenantContext).
   * Transaction-local via the helper, so nothing leaks.
   */
  private withPanelTenant<T>(
    tenantId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await setTenantContext(manager, tenantId);
      return work(manager);
    });
  }



  /**
   * Top service-line names per salon. Read through get_public_salon_tags()
   * because service_lines is FORCE ROW LEVEL SECURITY and this public feed has
   * no tenant context (see migration 1730000000009).
   */
  private async loadTags(salonIds: string[]): Promise<Map<string, string[]>> {
    const grouped = new Map<string, string[]>();
    const ids = salonIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return grouped;

    const rows = await this.dataSource.query<Array<{ salon_id: string; tag: string }>>(
      `SELECT salon_id, tag FROM get_public_salon_tags($1::uuid[], $2::int)`,
      [ids, TAG_LIMIT],
    );
    for (const row of rows) {
      const list = grouped.get(row.salon_id);
      if (list) list.push(row.tag);
      else grouped.set(row.salon_id, [row.tag]);
    }
    return grouped;
  }

  /**
   * The salon of the signed-in staff user. The tenant id comes from the JWT
   * and the RLS scope is opened on that same id, so a token can never be spent
   * against another salon's row.
   */
  async staffTenant(user: AuthenticatedUser): Promise<SalonStaffProfile> {
    const tenantId = this.requireStaffTenant(user);

    const rows = await this.withTenant(tenantId, async (manager) => {
      return manager.query<SalonStaffRow[]>(
        `SELECT t.id,
                t.name,
                t.slug,
                t.address,
                t.phone,
                t.cover_image_url,
                t.is_active,
                t.rating,
                t.review_count,
                t.working_hours,
                t.profile_completed,
                (SELECT COUNT(*)::int FROM specialists s WHERE s.tenant_id = t.id AND s.is_active = true) AS specialists_count,
                (SELECT COUNT(*)::int FROM services sv WHERE sv.tenant_id = t.id AND sv.is_active = true) AS services_count
         FROM tenants t
         WHERE t.id = $1`,
        [tenantId],
      );
    });

    const row = rows[0];
    if (!row) throw new NotFoundException('ط¨ظ‡ ط³ط§ظ„ظ†غŒ ظ…طھطµظ„ ظ†غŒط³طھغŒط¯');

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: row.address,
      phone: row.phone,
      coverImage: row.cover_image_url,
      status: row.is_active ? 'active' : 'inactive',
      rating: toNumber(row.rating) ?? 0,
      reviewCount: row.review_count ?? 0,
      workingHours: row.working_hours ?? {},
      specialistsCount: row.specialists_count ?? 0,
      servicesCount: row.services_count ?? 0,
      profileCompleted: row.profile_completed ?? false,
    };
  }

  /**
   * Approval state of the signed-in staff user's own salon.
   *
   * Read through `withTenant`, like `staffTenant` above: the tenant id comes
   * from the JWT, so a token can never be pointed at another salon's row. A
   * specialist, an owner and a manager all see the same state for the salon
   * they belong to.
   */
  async staffApprovalStatus(user: AuthenticatedUser): Promise<SalonApprovalStatus> {
    const tenantId = this.requireStaffTenant(user);

    const rows = await this.withTenant(tenantId, (manager) =>
      manager.query<
        Array<{
          status: SalonApprovalState;
          rejection_reason: string | null;
          pending_changes: Record<string, unknown> | null;
        }>
      >(
        `SELECT t.status, t.rejection_reason, t.pending_changes
           FROM tenants t
          WHERE t.id = $1`,
        [tenantId],
      ),
    );

    const row = rows[0];
    if (!row) throw new NotFoundException('ط¨ظ‡ ط³ط§ظ„ظ†غŒ ظ…طھطµظ„ ظ†غŒط³طھغŒط¯');

    return {
      status: row.status,
      rejectionReason: row.rejection_reason,
      hasPendingChanges:
        row.pending_changes !== null && Object.keys(row.pending_changes).length > 0,
    };
  }

  /**
   * PATCH /salon/me â€” the profile fields the approval policy gates.
   *
   * Nothing is written to the live row. The values go into
   * `tenants.pending_changes` and the tenant flips to 'pending_approval'; the
   * public catalogue therefore keeps serving the previously approved name
   * until an admin merges the change (ApprovalsService.approve).
   *
   * The one exception is `profile_completed`, which is set on the live row
   * right here: it records that the owner has *filled in* the onboarding form,
   * not that the values are published. Making it wait for admin approval would
   * leave the owner stuck on the setup screen forever, because the screen is
   * driven by this flag while the fields it submitted are still queued. The
   * flag and the staged values therefore move independently — see migration
   * 1730000000033 for the backfill that keeps pre-existing salons off this
   * screen.
   */
  async updateStaffProfile(
    user: AuthenticatedUser,
    dto: UpdateSalonProfileDto,
  ): Promise<SalonPendingUpdate> {
    const tenantId = this.requireStaffTenant(user);

    // Only the five gated fields, and only when the client actually sent them.
    // A field left out keeps whatever is already pending, so a second PATCH
    // carrying just the phone number cannot silently discard a name that is
    // still waiting for review.
    //
    // An explicit null is dropped rather than stored: the approve-side merge
    // reads pending_changes with COALESCE(->> key, column) and could not tell
    // a deliberate null apart from an absent key.
    const changes: Record<string, unknown> = {};
    if (dto.name) changes.name = dto.name;
    if (dto.address) changes.address = dto.address;
    if (dto.phone) changes.phone = dto.phone;
    if (dto.coverImage) changes.coverImage = dto.coverImage;
    if (dto.workingHours) changes.workingHours = dto.workingHours;

    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('ظپغŒظ„ط¯ ظ‚ط§ط¨ظ„ ظˆغŒط±ط§غŒط´غŒ ط§ط±ط³ط§ظ„ ظ†ط´ط¯ظ‡ ط§ط³طھ');
    }

    return this.stagePendingChanges(tenantId, changes);
  }

  /**
   * PATCH /salon/me/schedule â€” the weekly schedule, which is approval-gated
   * exactly like the profile fields. A separate route only so the salon app can
   * save the schedule form without having to know the profile payload.
   */
    async updateStaffSchedule(
    user: AuthenticatedUser,
    dto: UpdateSalonScheduleDto,
  ): Promise<SalonPendingUpdate> {
    const tenantId = this.requireStaffTenant(user);
    return this.stagePendingChanges(tenantId, { workingHours: dto.workingHours });
  }
  /**
   * POST /salon/me/schedule/block — blocks a time range for the salon or a
   * specific specialist. Used for walk-in customers or personal time off.
   *
   * A salon-independent `freelance_mobile` specialist has no tenant in the
   * token, so their block carries `tenant_id IS NULL` and is scoped to the
   * `specialists` row that points back at them (migration 1792700000000).
   * The two kinds never mix: a staff caller always blocks inside their own
   * tenant, a mobile caller always blocks their own calendar.
   */
  async createScheduleBlock(
    user: AuthenticatedUser,
    dto: CreateScheduleBlockDto,
  ): Promise<{ id: string }> {
    const scope = await this.blockScope(user);
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('تاریخ نامعتبر است');
    }
    if (start >= end) {
      throw new BadRequestException('زمان پایان باید پس از زمان شروع باشد');
    }

    const specialistId = await this.assertBlockTarget(scope, dto.specialistId);

    const rows = await this.withBlockScope(scope, async (manager) => {
      // Serialises block creation against booking creation for the same
      // calendar: both take this advisory lock before checking, so a booking
      // cannot slip into a slot while its block is being written (and vice
      // versa). Memory-only, released at COMMIT.
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext($1)), pg_advisory_xact_lock(hashtext($2))`,
        [`block:spec:${specialistId ?? 'any'}`, `block:salon:${scope.tenantId ?? 'none'}`],
      );

      return manager.query<Array<{ id: string }>>(
        `INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [scope.tenantId, specialistId, start, end, dto.reason ?? null],
      );
    });

    return { id: rows[0].id };
  }

  /**
   * DELETE /salon/me/schedule/block/:id — removes a previously created block.
   * A mobile caller may only remove a block on their own calendar.
   */
  async deleteScheduleBlock(user: AuthenticatedUser, id: string): Promise<void> {
    const scope = await this.blockScope(user);
    await this.withBlockScope(scope, async (manager) => {
      const result = await manager.query<Array<{ id: string }>>(
        scope.tenantId
          ? `DELETE FROM schedule_blocks WHERE id = $1 AND tenant_id = $2 RETURNING id`
          : `DELETE FROM schedule_blocks
              WHERE id = $1
                AND tenant_id IS NULL
                AND specialist_id IN (SELECT id FROM specialists WHERE user_id = $2 AND is_active = true)
              RETURNING id`,
        scope.tenantId ? [id, scope.tenantId] : [id, scope.userId!],
      );
      if (!Array.isArray(result) || result.length === 0) {
        throw new NotFoundException('مسدودی یافت نشد');
      }
    });
  }

  /**
   * GET /salon/me/schedule/blocks — the caller's own blocks, earliest first.
   * RLS keeps each salon's blocks private from the others; the mobile
   * specialist sees only the rows that carry their own `specialists.id`.
   */
  async listScheduleBlocks(user: AuthenticatedUser): Promise<SalonScheduleBlockList> {
    const scope = await this.blockScope(user);
    const rows = await this.withBlockScope(scope, (manager) =>
      manager.query<ScheduleBlockRow[]>(
        scope.tenantId
          ? `SELECT id, tenant_id, specialist_id, start_time, end_time, reason
               FROM schedule_blocks
              WHERE tenant_id = $1
              ORDER BY start_time ASC, id ASC`
          : `SELECT id, tenant_id, specialist_id, start_time, end_time, reason
               FROM schedule_blocks
              WHERE tenant_id IS NULL
                AND specialist_id IN (SELECT id FROM specialists WHERE user_id = $1 AND is_active = true)
              ORDER BY start_time ASC, id ASC`,
        scope.tenantId ? [scope.tenantId] : [scope.userId!],
      ),
    );

    return { data: rows.map((row) => this.toScheduleBlockItem(row)) };
  }
  /**
   * Overlay `changes` on whatever is already pending and mark the tenant as
   * awaiting review. The live columns stay untouched, which is the whole point
   * of the workflow: nothing a salon submits becomes publicly visible before
   * an admin says so.
   *
   * A resubmission clears `rejection_reason`, since a fresh request supersedes
   * the decision that rejected the previous one.
   *
   * `profile_completed` is the deliberate exception and is stamped on the live
   * row here, because every caller of this method is the owner submitting the
   * onboarding/profile form — the mixin that stores the field marked the
   * prompt *submitted*, not the values approved. It is set unconditionally
   * (including by `PATCH /salon/me/schedule`, which is the same form posting
   * the schedule half), so the app's routing flag cannot lag a successful
   * submit.
   */
  private async stagePendingChanges(
    tenantId: string,
    changes: Record<string, unknown>,
  ): Promise<SalonPendingUpdate> {
    // `||` is jsonb concatenation, so a pending field the caller did not resend
    // is preserved rather than replaced by the smaller payload.
    await this.dataSource.query(
      `UPDATE tenants
          SET pending_changes = COALESCE(pending_changes, '{}'::jsonb) || $2::jsonb,
              status = 'pending_approval',
              rejection_reason = NULL,
              profile_completed = TRUE
        WHERE id = $1`,
      [tenantId, JSON.stringify(changes)],
    );

    return { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE };
  }

  /**
   * Today/week snapshot of the signed-in staff user.
   *
   * A specialist only ever sees their own rows: the booking filter is pinned to
   * the `specialists` row owned by the JWT user id. The tenant scope still comes
   * from the token, never from the request body.
   */
  async staffDashboard(user: AuthenticatedUser): Promise<SalonDashboardPayload> {
    const tenantId = this.requireStaffTenant(user);

    const now = new Date();
    const todayStart = startOfTehranDay(now);
    const todayEnd = new Date(todayStart.getTime() + DAY_MS);
    const weekStart = startOfTehranWeek(now);
    const weekEnd = endOfTehranWeek(now);

    return this.withTenant(tenantId, async (manager) => {
      const specialistId = user.role === 'specialist'
        ? await this.activeSpecialistId(manager, user.userId)
        : null;
      if (user.role === 'specialist' && !specialistId) {
        throw new NotFoundException('ط§ط·ظ„ط§ط¹ط§طھ ظ…طھط®طµطµ ط´ظ…ط§ ط¯ط± ط³ط§ظ„ظ† غŒط§ظپطھ ظ†ط´ط¯');
      }

      const [today, week, pendingRow] = await Promise.all([
        this.dashboardAggregate(manager, todayStart, todayEnd, specialistId),
        this.dashboardAggregate(manager, weekStart, weekEnd, specialistId),
        manager.query<Array<{ pending: number }>>(
          `SELECT COUNT(*)::int AS pending
           FROM bookings b
           WHERE b.status = 'pending'${specialistId ? ' AND b.specialist_id = $1' : ''}`,
          specialistId ? [specialistId] : [],
        ),
      ]);

      const [daily] = await Promise.all([
        manager.query<SalonDashboardDayRow[]>(
          `SELECT (EXTRACT(DOW FROM (lower(b.time_slot) AT TIME ZONE 'Asia/Tehran'))::int + 1) % 7 AS day_index,
                  COALESCE(SUM(b.total_price::numeric) FILTER (WHERE ${REVENUE_STATUSES}), 0)::numeric AS amount
           FROM bookings b
           WHERE b.time_slot && tstzrange($1::timestamptz, $2::timestamptz, '[)')
             AND ${ACTIVE_BOOKING_STATUSES}${specialistId ? ' AND b.specialist_id = $3' : ''}
           GROUP BY 1
           ORDER BY 1`,
          withSpecialistId([weekStart.toISOString(), weekEnd.toISOString()], specialistId),
        ),
      ]);

      return {
        todayBookings: today.bookings,
        todayRevenue: toNumber(today.revenue) ?? 0,
        weekBookings: week.bookings,
        weekRevenue: toNumber(week.revenue) ?? 0,
        pendingBookings: pendingRow[0]?.pending ?? 0,
        weeklyRevenue: buildWeeklyRevenue(daily),
        topSpecialists: await this.dashboardTopSpecialists(manager, weekStart, weekEnd, specialistId),
      };
    });
  }

  /**
   * Booking count and revenue inside one half-open window. Canceled and
   * no-show rows are dropped from both numbers, since they never happened;
   * pending rows count as bookings but not as revenue.
   */
  private async dashboardAggregate(
    manager: EntityManager,
    start: Date,
    end: Date,
    specialistId: string | null,
  ): Promise<SalonDashboardAggregateRow> {
    const rows = await manager.query<SalonDashboardAggregateRow[]>(
      `SELECT COUNT(*)::int AS bookings,
              COALESCE(SUM(b.total_price::numeric) FILTER (WHERE ${REVENUE_STATUSES}), 0)::numeric AS revenue
       FROM bookings b
       WHERE b.time_slot && tstzrange($1::timestamptz, $2::timestamptz, '[)')
         AND ${ACTIVE_BOOKING_STATUSES}${specialistId ? ' AND b.specialist_id = $3' : ''}`,
      withSpecialistId([start.toISOString(), end.toISOString()], specialistId),
    );

    return rows[0] ?? { bookings: 0, revenue: '0' };
  }

  /**
   * Up to five specialists, best revenue of the week first. Ties break on the
   * booking count and then on the id so the ranking stays stable for a snapshot
   * that is recomputed on every refresh.
   */
  private async dashboardTopSpecialists(
    manager: EntityManager,
    start: Date,
    end: Date,
    specialistId: string | null,
  ): Promise<SalonDashboardTopSpecialist[]> {
    const rows = await manager.query<SalonDashboardSpecialistRow[]>(
      `SELECT s.id,
              u.full_name,
              COUNT(b.id)::int AS bookings,
              COALESCE(SUM(b.total_price::numeric) FILTER (WHERE ${REVENUE_STATUSES}), 0)::numeric AS revenue
       FROM bookings b
       JOIN specialists s ON s.id = b.specialist_id
       JOIN users u ON u.id = s.user_id
       WHERE b.time_slot && tstzrange($1::timestamptz, $2::timestamptz, '[)')
         AND ${ACTIVE_BOOKING_STATUSES}${specialistId ? ' AND b.specialist_id = $3' : ''}
       GROUP BY s.id, u.full_name
       ORDER BY revenue DESC, bookings DESC, s.id
       LIMIT 5`,
      withSpecialistId([start.toISOString(), end.toISOString()], specialistId),
    );

    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      bookings: row.bookings,
      revenue: toNumber(row.revenue) ?? 0,
    }));
  }

  /**
   * The `specialists` row owned by this JWT user, if any. `users` and
   * `specialists` are FORCE RLS on `app.current_tenant_id`, so this runs inside the
   * tenant scope opened by `withTenant`.
   */
  private async activeSpecialistId(manager: EntityManager, userId: string): Promise<string | null> {
    const rows = await manager.query<Array<{ id: string }>>(
      `SELECT id FROM specialists WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
    return rows[0]?.id ?? null;
  }

  // -------------------------------------------------------------------------
  // Panel: service lines and their services. Every read/write runs inside
  // `withTenant`, so the RLS scope is the JWT tenant â€” a token can never touch
  // another salon's rows.
  // -------------------------------------------------------------------------

  /** GET /salon/me/lines â€” every line of the salon, oldest first. */
  async listServiceLines(user: AuthenticatedUser): Promise<SalonServiceLineItem[]> {
    const tenantId = this.requireStaffTenant(user);
    const rows = await this.withTenant(tenantId, (manager) =>
      manager.query<SalonServiceLineRow[]>(
        `SELECT sl.id,
                sl.name,
                sl.description,
                sl.is_active,
                sl.status,
                sl.created_at,
                (SELECT COUNT(*)::int
                   FROM services s
                  WHERE s.line_id = sl.id AND s.is_active = true) AS services_count
           FROM service_lines sl
          WHERE sl.tenant_id = $1
          ORDER BY sl.created_at ASC, sl.id ASC`,
        [tenantId],
      ),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      status: row.status,
      servicesCount: row.services_count ?? 0,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /** POST /salon/me/lines â€” a new line, staged for admin approval. */
  async createServiceLine(
    user: AuthenticatedUser,
    dto: CreateServiceLineDto,
  ): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withTenant(tenantId, async (manager) => {
      const duplicate = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM service_lines WHERE tenant_id = $1 AND name = $2`,
        [tenantId, dto.name],
      );
      if (duplicate.length > 0) {
        throw new BadRequestException('ط®ط·غŒ ط¨ط§ ط§غŒظ† ظ†ط§ظ… ظ‚ط¨ظ„ط§ظ‹ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
      }
      await manager.query(
        `INSERT INTO service_lines (tenant_id, name, description, status, is_active)
         VALUES ($1, $2, $3, 'pending_approval', true)`,
        [tenantId, dto.name, dto.description ?? null],
      );
      return { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE };
    });
  }

  /**
   * PATCH /salon/me/lines/:id â€” edits a line. Only `name` is approval-gated:
   * changing it flips the line to `pending_approval` and clears `approved_at`
   * so it drops out of the public catalogue until an admin approves. Cosmetic
   * edits (`description`, `is_active`) apply immediately and keep the status.
   */
  async updateServiceLine(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateServiceLineDto,
  ): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withTenant(tenantId, async (manager) => {
      const rows = await manager.query<
        Array<{ id: string; name: string; status: ApprovalStatus }>
      >(
        `SELECT id, name, status FROM service_lines WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      const line = rows[0];
      if (!line) throw new NotFoundException('ط®ط· ط®ط¯ظ…ط§طھغŒ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      const nameChanges = dto.name !== undefined && dto.name !== line.name;

      if (nameChanges) {
        const duplicate = await manager.query<Array<{ id: string }>>(
          `SELECT id FROM service_lines WHERE tenant_id = $1 AND name = $2 AND id <> $3`,
          [tenantId, dto.name, id],
        );
        if (duplicate.length > 0) {
          throw new BadRequestException('ط®ط·غŒ ط¨ط§ ط§غŒظ† ظ†ط§ظ… ظ‚ط¨ظ„ط§ظ‹ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
        }
      }

      const sets: string[] = [];
      const params: unknown[] = [tenantId, id];
      const push = (value: unknown): string => {
        params.push(value);
        return `$${params.length}`;
      };
      if (dto.name !== undefined) sets.push(`name = ${push(dto.name)}`);
      if (dto.description !== undefined) sets.push(`description = ${push(dto.description)}`);
      if (dto.isActive !== undefined) sets.push(`is_active = ${push(dto.isActive)}`);

      if (nameChanges) {
        sets.push(`status = 'pending_approval', approved_at = NULL, rejection_reason = NULL`);
      }

      await manager.query(
        `UPDATE service_lines SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
        params,
      );

      return nameChanges
        ? { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE }
        : { status: line.status, message: 'ط«ط¨طھ ط´ط¯' };
    });
  }

  /**
   * DELETE /salon/me/lines/:id â€” soft deletes a line (`is_active = false`).
   * Blocked while any of the line's services still carry an active booking, so
   * a salon cannot orphan a customer's reservation by hiding its line.
   */
  async deleteServiceLine(user: AuthenticatedUser, id: string): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withTenant(tenantId, async (manager) => {
      const rows = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM service_lines WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      if (rows.length === 0) throw new NotFoundException('ط®ط· ط®ط¯ظ…ط§طھغŒ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      const bookings = await manager.query<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count
           FROM bookings b
           JOIN services s ON s.id = b.service_id
          WHERE s.line_id = $1 AND ${ACTIVE_BOOKING_STATUSES}`,
        [id],
      );
      if ((bookings[0]?.count ?? 0) > 0) {
        throw new BadRequestException('ط§غŒظ† ط®ط· ط¯ط§ط±ط§غŒ ط±ط²ط±ظˆ ظپط¹ط§ظ„ ط§ط³طھ ظˆ ظپط¹ظ„ط§ظ‹ ظ‚ط§ط¨ظ„ ط­ط°ظپ ظ†غŒط³طھ');
      }

      await manager.query(
        `UPDATE service_lines SET is_active = false WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
    });
  }

  /** GET /salon/me/lines/:lineId/services â€” the services under one line. */
  async listServices(user: AuthenticatedUser, lineId: string): Promise<SalonServiceItem[]> {
    const tenantId = this.requireStaffTenant(user);
    const rows = await this.withTenant(tenantId, (manager) =>
      manager.query<SalonServiceRow[]>(
        `SELECT s.id,
                s.line_id,
                s.name,
                s.description,
                s.price,
                s.duration_minutes,
                s.deposit_required,
                s.deposit_amount,
                s.is_active,
                s.is_mobile_available,
                s.created_at
           FROM services s
          WHERE s.tenant_id = $1 AND s.line_id = $2
          ORDER BY s.created_at ASC, s.id ASC`,
        [tenantId, lineId],
      ),
    );
    return rows.map((row) => ({
      id: row.id,
      lineId: row.line_id,
      name: row.name,
      description: row.description,
      price: toNumber(row.price) ?? 0,
      durationMinutes: row.duration_minutes,
      depositRequired: row.deposit_required,
      depositAmount: toNumber(row.deposit_amount),
      isActive: row.is_active,
      isMobileAvailable: row.is_mobile_available,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /** POST /salon/me/lines/:lineId/services â€” a new service, effective at once. */
  async createService(
    user: AuthenticatedUser,
    lineId: string,
    dto: CreateServiceDto,
  ): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withTenant(tenantId, async (manager) => {
      const lines = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM service_lines WHERE tenant_id = $1 AND id = $2`,
        [tenantId, lineId],
      );
      if (lines.length === 0) throw new NotFoundException('ط®ط· ط®ط¯ظ…ط§طھغŒ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      await manager.query(
        `INSERT INTO services
           (tenant_id, line_id, name, description, duration_minutes, price,
            deposit_required, deposit_amount, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [
          tenantId,
          lineId,
          dto.name,
          dto.description ?? null,
          dto.durationMinutes ?? 60,
          dto.price,
          dto.depositRequired ?? false,
          dto.depositRequired ? dto.depositAmount ?? null : null,
        ],
      );
      return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
    });
  }

  /** PATCH /salon/me/services/:id â€” edits a service, effective at once. */
  async updateService(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withTenant(tenantId, async (manager) => {
      const rows = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM services WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      if (rows.length === 0) throw new NotFoundException('ط®ط¯ظ…طھ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      const sets: string[] = [];
      const params: unknown[] = [tenantId, id];
      const push = (value: unknown): string => {
        params.push(value);
        return `$${params.length}`;
      };
      if (dto.name !== undefined) sets.push(`name = ${push(dto.name)}`);
      if (dto.description !== undefined) sets.push(`description = ${push(dto.description)}`);
      if (dto.price !== undefined) sets.push(`price = ${push(dto.price)}`);
      if (dto.durationMinutes !== undefined) sets.push(`duration_minutes = ${push(dto.durationMinutes)}`);
      if (dto.depositRequired !== undefined) {
        sets.push(`deposit_required = ${push(dto.depositRequired)}`);
        if (dto.depositRequired === false) sets.push(`deposit_amount = NULL`);
        else if (dto.depositAmount !== undefined) sets.push(`deposit_amount = ${push(dto.depositAmount)}`);
      } else if (dto.depositAmount !== undefined) {
        sets.push(`deposit_amount = ${push(dto.depositAmount)}`);
      }
      if (dto.isActive !== undefined) sets.push(`is_active = ${push(dto.isActive)}`);
      if (dto.isMobileAvailable !== undefined) {
        sets.push(`is_mobile_available = ${push(dto.isMobileAvailable)}`);
      }

      if (sets.length > 0) {
        await manager.query(
          `UPDATE services SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
          params,
        );
      }
      return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
    });
  }

  /** DELETE /salon/me/services/:id â€” soft deletes a service (`is_active = false`). */
  async deleteService(user: AuthenticatedUser, id: string): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withTenant(tenantId, async (manager) => {
      const rows = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM services WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      if (rows.length === 0) throw new NotFoundException('ط®ط¯ظ…طھ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
      await manager.query(
        `UPDATE services SET is_active = false WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
    });
  }

  /**
   * GET /salon/me/specialists â€” every specialist of the signed-in salon with
   * the user row that carries the display name and phone. Inactive rows are
   * included on purpose: this listing is where a specialist gets turned back
   * on, unlike the public catalogue which shows only `is_active` ones.
   */
  async listPanelSpecialists(user: AuthenticatedUser): Promise<SalonPanelSpecialistItem[]> {
    const tenantId = this.requireStaffTenant(user);
    let rows: PanelSpecialistRow[];

    // Restrict specialist to their own row only.
    if (user.role === 'specialist') {
      rows = await this.withPanelTenant(tenantId, (manager) =>
        manager.query<PanelSpecialistRow[]>(
          `SELECT sp.id,
                  sp.user_id,
                  u.full_name,
                  u.phone,
                  u.avatar_url,
                  sp.bio,
                  sp.skills,
                  sp.commission_rate,
                  sp.is_active,
                  sp.offers_mobile_service,
                  (SELECT COUNT(*)::int FROM bookings b WHERE b.specialist_id = sp.id) AS bookings_count
             FROM specialists sp
             LEFT JOIN users u ON u.id = sp.user_id
            WHERE sp.tenant_id = $1 AND sp.user_id = $2
            ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC`,
          [tenantId, user.userId],
        ),
      );
    } else {
      rows = await this.withPanelTenant(tenantId, (manager) =>
        manager.query<PanelSpecialistRow[]>(
          `SELECT sp.id,
                  sp.user_id,
                  u.full_name,
                  u.phone,
                  u.avatar_url,
                  sp.bio,
                  sp.skills,
                  sp.commission_rate,
                  sp.is_active,
                  sp.offers_mobile_service,
                  (SELECT COUNT(*)::int FROM bookings b WHERE b.specialist_id = sp.id) AS bookings_count
             FROM specialists sp
             LEFT JOIN users u ON u.id = sp.user_id
            WHERE sp.tenant_id = $1
            ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC`,
          [tenantId],
        ),
      );
    }

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      skills: row.skills ?? [],
      commissionRate: toNumber(row.commission_rate) ?? 50,
      isActive: row.is_active,
      offersMobileService: row.offers_mobile_service,
      bookingsCount: row.bookings_count,
    }));
  }

  /**
   * GET /salon/me/bookings — the salon panel's booking working surface.
   *
   * `bookings` and `service_lines` are FORCE ROW LEVEL SECURITY on the tenant
   * GUC, so this runs inside [withPanelTenant]; that is what makes the counts
   * and the row reads agree instead of each seeing a different slice. The
   * customer name needs the extra `salon_panel_customer_contacts()` helper
   * (migration 1730000000021) because `users` hides tenant-less customers —
   * see the migration's comment for why relaxing that policy is not an option.
   *
   * The role decides what the list may contain at all: an owner or admin sees
   * the whole tenant, a line manager only the lines they manage, and a
   * specialist only their own bookings. That scoping is applied in SQL, not in
   * JS — filtering afterwards would leave `total` and the per-status `counts`
   * describing rows the caller was never allowed to see.
   */
  async listPanelBookings(
    user: AuthenticatedUser,
    query: SalonPanelBookingsQueryDto,
  ): Promise<SalonPanelBookingPage> {
    const tenantId = this.requireStaffTenant(user);
    return this.withPanelTenant(tenantId, async (manager) => {
      const scope = await this.resolveBookingScope(manager, user, tenantId);
      const { startIso, endIso } = this.bookingWindow(query);

      // One pass over the filtered set for every tab at once. Splitting this
      // into six COUNT queries would read the same rows six times and let the
      // counts drift from the list between two statements.
      // The tabs are counted over the window *without* the status filter, which
      // is what makes the tab numbers stable while switching between them.
      //
      // It gets its own [bookingFilters] pass with `offset: 0` and binds only
      // `whereParams`. This statement never spends a `$1` on the tenant (it
      // needs no customer contacts), so prefixing the tenant id — as the list
      // does — would ask for one more parameter than the SQL uses and Postgres
      // rejects the bind outright.
      const countFilters = this.bookingFilters(scope, undefined, startIso, endIso, 0);
      const countRows = await manager.query<Array<{ status: string; total: string | number }>>(
        `SELECT b.status, COUNT(*)::int AS total
           FROM bookings b
           LEFT JOIN services sv ON sv.id = b.service_id
          WHERE ${countFilters.where}
          GROUP BY b.status`,
        countFilters.whereParams,
      );

      const filters = this.bookingFilters(scope, query, startIso, endIso, 1);

      // The list binds `$1` to the tenant, then the where params, then the
      // optional status, then the page window — so the page placeholders sit
      // after all of them. Hardcoding `LIMIT $2 OFFSET $3` collided with the
      // scope/status params as soon as either was non-empty.
      const limitPlaceholder = 1 + filters.whereParams.length + filters.statusParams.length + 1;
      const offsetPlaceholder = limitPlaceholder + 1;

      const rows = await manager.query<PanelBookingRow[]>(
        `WITH scoped AS (
           SELECT b.id,
                  b.status,
                  lower(b.time_slot) AS starts_at,
                  upper(b.time_slot) AS ends_at,
                  b.total_price,
                  b.deposit_paid,
                  b.notes,
                  b.created_at,
                  b.customer_id,
                  b.specialist_id,
                  b.service_id,
                  b.is_mobile,
                  b.customer_address,
                  b.customer_latitude,
                  b.customer_longitude
             FROM bookings b
             LEFT JOIN services sv ON sv.id = b.service_id
            WHERE ${filters.where}
         ),
         contacts AS (
           SELECT c.customer_id, c.full_name, c.phone
             FROM salon_panel_customer_contacts(
                    $1::uuid,
                    ARRAY(SELECT DISTINCT sc.customer_id FROM scoped sc)
                  ) c
         )
         SELECT sc.id,
                sc.status,
                sc.starts_at,
                sc.ends_at,
                sc.total_price,
                sc.deposit_paid,
                sc.notes,
                sc.created_at,
                sc.customer_id,
                contacts.full_name AS customer_name,
                contacts.phone AS customer_phone,
                sc.specialist_id,
                u.full_name AS specialist_name,
                sc.service_id,
                sv.name AS service_name,
                sv.line_id,
                 sc.is_mobile,
                 sc.customer_address,
                 sc.customer_latitude,
                 sc.customer_longitude
            FROM scoped sc
           LEFT JOIN contacts ON contacts.customer_id = sc.customer_id
           LEFT JOIN specialists sp ON sp.id = sc.specialist_id
           LEFT JOIN users u ON u.id = sp.user_id
           LEFT JOIN services sv ON sv.id = sc.service_id
          WHERE ${filters.statusWhere}
          ORDER BY sc.starts_at DESC, sc.id DESC
          LIMIT $${limitPlaceholder} OFFSET $${offsetPlaceholder}`,
        [
          tenantId,
          ...filters.whereParams,
          ...filters.statusParams,
          query.limit,
          (query.page - 1) * query.limit,
        ],
      );

      const counts = this.zeroBookingCounts();
      let total = 0;
      for (const row of countRows) {
        const value = toNumber(row.total) ?? 0;
        total += value;
        switch (row.status) {
          case SalonBookingStatus.Pending:
            counts.pending = value;
            break;
          case SalonBookingStatus.Confirmed:
            counts.confirmed = value;
            break;
          case SalonBookingStatus.Completed:
            counts.completed = value;
            break;
          case SalonBookingStatus.Reviewed:
            counts.reviewed = value;
            break;
          case SalonBookingStatus.Cancelled:
            counts.cancelled = value;
            break;
          case SalonBookingStatus.NoShow:
            counts.noShow = value;
            break;
        }
      }

      // `total` is the count of the *selected* status: the screen renders one
      // page of it, so a page indicator over the whole month would promise
      // pages that do not exist.
      const effectiveTotal =
        query.status === undefined
          ? total
          : (toNumber(countRows.find((row) => row.status === query.status)?.total) ?? 0);

      return {
        data: rows.map((row) => this.toPanelBookingItem(row)),
        total: effectiveTotal,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(effectiveTotal / query.limit)),
        counts,
      };
    });
  }

  /**
   * GET /salon/me/bookings/:id — one booking, with the salon's working hours and
   * settings, which the detail screen needs to judge a slot against the day.
   *
   * 404 for a booking of another tenant (nothing about it may be confirmed to
   * exist) and 403 for one the caller's role may not act on — a specialist
   * asking for a colleague's appointment gets 403, not 404, so the app can say
   * "this is not yours" rather than "no such booking".
   */
  async getPanelBooking(user: AuthenticatedUser, id: string): Promise<SalonPanelBookingDetail> {
    const tenantId = this.requireStaffTenant(user);
    return this.withPanelTenant(tenantId, async (manager) => {
      const scope = await this.resolveBookingScope(manager, user, tenantId);
      const row = await this.findScopedPanelBooking(manager, tenantId, id, scope);
      return this.toPanelBookingDetail(manager, tenantId, row);
    });
  }

  /**
   * POST /salon/me/bookings/:id/approve — pending → confirmed.
   *
   * The event carries the service id as `''` when the booking has none, because
   * the notification listener is already written to skip the service name in
   * that case (its `findById(...).catch(() => null)`); it is not a placeholder.
   */
  async approvePanelBooking(
    user: AuthenticatedUser,
    id: string,
  ): Promise<SalonPanelBookingDetail> {
    const tenantId = this.requireStaffTenant(user);
    const result = await this.transitionPanelBooking(
      user,
      id,
      SalonBookingStatus.Pending,
      'این رزرو قبلاً بررسی شده است',
      async (manager) => {
        const updated = await manager.query(
          `UPDATE bookings
              SET status = 'confirmed',
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'pending'`,
          [id, tenantId],
        );
        if (affectedRows(updated) !== 1) {
          throw new ConflictException('این رزرو قبلاً بررسی شده است');
        }
      },
    );

    const event: BookingConfirmedEvent = {
      bookingId: result.id,
      tenantId,
      customerId: result.customerId,
      specialistId: result.specialistId,
      serviceId: result.serviceId ?? '',
    };
    this.events.emit(BOOKING_CONFIRMED, event);
    return result;
  }

  /**
   * POST /salon/me/bookings/:id/reject — pending → cancelled, on the salon's
   * side. The reason is mandatory here (it reaches the customer) and is
   * appended to `notes` the same way `BookingService.reject` does, so both
   * paths leave the same trace.
   */
  async rejectPanelBooking(
    user: AuthenticatedUser,
    id: string,
    dto: SalonPanelRejectBookingDto,
  ): Promise<SalonPanelBookingDetail> {
    const tenantId = this.requireStaffTenant(user);
    const reason = dto.reason.trim();
    const result = await this.transitionPanelBooking(
      user,
      id,
      SalonBookingStatus.Pending,
      'این رزرو قبلاً بررسی شده است',
      async (manager) => {
        const updated = await manager.query(
          `UPDATE bookings
              SET status = 'cancelled',
                  notes = CASE
                            WHEN notes IS NULL OR notes = '' THEN $3
                            ELSE notes || E'\n— ' || $3
                          END,
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'pending'`,
          [id, tenantId, reason],
        );
        if (affectedRows(updated) !== 1) {
          throw new ConflictException('این رزرو قبلاً بررسی شده است');
        }
      },
    );

    const event: BookingCancelledEvent = {
      bookingId: result.id,
      tenantId,
      customerId: result.customerId,
      // Same reason token BookingService.reject uses, so the customer-facing
      // message stays the same regardless of which side declined the request.
      reason: 'specialist_unavailable',
      // Nothing was paid for a booking that never ran, so there is nothing to
      // refund — the customer is told the amount was returned.
      refundAmount: 0,
    };
    this.events.emit(BOOKING_CANCELLED, event);
    return result;
  }

  /**
   * POST /salon/me/bookings/:id/mark-visited — confirmed → completed.
   *
   * Marking a visit is the salon's own statement that the service happened, so
   * it is deliberately not a customer-visible "cancelled by salon" flow and
   * emits no event: no refund notice, no re-request prompt.
   */
  async markVisitedPanelBooking(
    user: AuthenticatedUser,
    id: string,
  ): Promise<SalonPanelBookingDetail> {
    const tenantId = this.requireStaffTenant(user);
    return this.transitionPanelBooking(
      user,
      id,
      SalonBookingStatus.Confirmed,
      'این رزرو قبلاً بررسی شده است',
      async (manager) => {
        const updated = await manager.query(
          `UPDATE bookings
              SET status = 'completed',
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'confirmed'`,
          [id, tenantId],
        );
        if (affectedRows(updated) !== 1) {
          throw new ConflictException('این رزرو قبلاً بررسی شده است');
        }
      },
    );
  }

  /**
   * POST /salon/me/bookings/:id/no-show — confirmed → no_show.
   *
   * The `lower(time_slot) <= NOW()` guard is the point of this endpoint: a
   * no-show is a claim about the past, so marking an appointment that has not
   * started yet would be a lie the customer cannot appeal. It is checked in
   * the UPDATE itself, so two panels pressing the button at once cannot both
   * win, and the losing one gets the ordinary conflict message.
   */
  async noShowPanelBooking(
    user: AuthenticatedUser,
    id: string,
  ): Promise<SalonPanelBookingDetail> {
    const tenantId = this.requireStaffTenant(user);
    return this.transitionPanelBooking(
      user,
      id,
      SalonBookingStatus.Confirmed,
      'این رزرو قبلاً بررسی شده است',
      async (manager) => {
        const updated = await manager.query(
          `UPDATE bookings
              SET status = 'no_show',
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'confirmed'
              AND lower(time_slot) <= NOW()`,
          [id, tenantId],
        );
        if (affectedRows(updated) !== 1) {
          throw new ConflictException('این رزرو قبلاً بررسی شده است');
        }
      },
    );
  }

  /**
   * The shared body of the four action endpoints: check the caller may act,
   * check the row is in the expected state, apply the change, read it back.
   *
   * The status is re-read *after* the UPDATE rather than trusted from the
   * request, so two admins working the same list cannot both be told they
   * approved the same pending booking.
   */
  private async transitionPanelBooking(
    user: AuthenticatedUser,
    id: string,
    from: SalonBookingStatus,
    conflictMessage: string,
    update: (manager: EntityManager) => Promise<void>,
  ): Promise<SalonPanelBookingDetail> {
    const tenantId = this.requireStaffTenant(user);
    return this.withPanelTenant(tenantId, async (manager) => {
      const scope = await this.resolveBookingScope(manager, user, tenantId);
      const current = await this.findScopedPanelBooking(manager, tenantId, id, scope);
      if (current.status !== from) {
        throw new ConflictException(conflictMessage);
      }
      await update(manager);
      // Re-read, so the response describes the row that is now in the database
      // rather than the one the caller was shown before the change.
      const row = await this.findScopedPanelBooking(manager, tenantId, id, scope);
      return this.toPanelBookingDetail(manager, tenantId, row);
    });
  }

  /** The tenant's working hours and settings, for the detail response. */
  private async loadTenantPanelContext(
    manager: EntityManager,
    tenantId: string,
  ): Promise<PanelBookingTenantRow> {
    const rows = await manager.query<PanelBookingTenantRow[]>(
      `SELECT working_hours, settings FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (rows.length === 0) throw new NotFoundException('سالن یافت نشد');
    return rows[0];
  }

  private async toPanelBookingDetail(
    manager: EntityManager,
    tenantId: string,
    row: PanelBookingRow,
  ): Promise<SalonPanelBookingDetail> {
    const tenant = await this.loadTenantPanelContext(manager, tenantId);
    return {
      ...this.toPanelBookingItem(row),
      workingHours: (tenant.working_hours ?? {}) as Record<string, unknown>,
      settings: (tenant.settings ?? {}) as Record<string, unknown>,
    };
  }

  /**
   * One booking, if the caller's scope allows seeing it.
   *
   * The `id` and the scope predicates share one parameter list, with the id
   * pinned to `$2` and the scope parameters after it — a separate query for
   * the scope would need a second round trip and could read the row under a
   * different set of rules than the caller actually has.
   */
  private async findScopedPanelBooking(
    manager: EntityManager,
    tenantId: string,
    id: string,
    scope: PanelBookingScope,
  ): Promise<PanelBookingRow> {
    const filters = this.bookingFilters(scope, undefined, undefined, undefined, 2);
    const rows = await manager.query<PanelBookingRow[]>(
      `SELECT b.id,
              b.status,
              lower(b.time_slot) AS starts_at,
              upper(b.time_slot) AS ends_at,
              b.total_price,
              b.deposit_paid,
              b.notes,
              b.created_at,
              b.customer_id,
              b.specialist_id,
              b.service_id,
              b.is_mobile,
              b.customer_address,
              b.customer_latitude,
              b.customer_longitude,
              sv.name AS service_name,
              sv.line_id,
              u.full_name AS specialist_name,
              c.full_name AS customer_name,
              c.phone AS customer_phone
         FROM bookings b
         LEFT JOIN services sv ON sv.id = b.service_id
         LEFT JOIN specialists sp ON sp.id = b.specialist_id
         LEFT JOIN users u ON u.id = sp.user_id
         LEFT JOIN salon_panel_customer_contacts($1::uuid, ARRAY[b.customer_id]) c
                ON c.customer_id = b.customer_id
        WHERE b.id = $2
          AND ${filters.where}`,
      [tenantId, id, ...filters.whereParams],
    );
    if (rows.length === 0) {
      throw new NotFoundException('رزرو یافت نشد');
    }
    return rows[0];
  }

  /**
   * What the caller's role lets them see, as a reusable SQL fragment.
   *
   * Deny by default: a specialist whose `specialists` row is missing, or a line
   * manager with no lines, gets `FALSE` and therefore an empty list — never a
   * tenant-wide one, because a broken profile must not widen access.
   */
  private async resolveBookingScope(
    manager: EntityManager,
    user: AuthenticatedUser,
    tenantId: string,
  ): Promise<PanelBookingScope> {
    if (user.role === 'salon_owner' || user.role === 'admin') {
      return { fragment: 'b.tenant_id = $1', params: [tenantId] };
    }

    if (user.role === 'line_manager') {
      const rows = await manager.query<Array<{ id: string }>>(
        `SELECT sl.id AS id
           FROM service_lines sl
          WHERE sl.tenant_id = $1
            AND sl.manager_id = $2
            AND sl.is_active = TRUE`,
        [tenantId, user.userId],
      );
      if (rows.length === 0) return { fragment: 'FALSE', params: [] };
      return {
        fragment: 'b.tenant_id = $1 AND sv.line_id = ANY($2::uuid[])',
        params: [tenantId, rows.map((row) => row.id)],
      };
    }

    if (user.role === 'specialist') {
      const rows = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM specialists WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, user.userId],
      );
      if (rows.length === 0) return { fragment: 'FALSE', params: [] };
      return {
        fragment: 'b.tenant_id = $1 AND b.specialist_id = $2',
        params: [tenantId, rows[0].id],
      };
    }

    return { fragment: 'FALSE', params: [] };
  }

  /**
   * The list query's WHERE clauses, bound for its own parameter positions.
   *
   * The list spends `$1` on the tenant id (for `salon_panel_customer_contacts`),
   * so every predicate after that starts at `$2`; the single-row read in
   * [findScopedPanelBooking] spends `$1` and `$2` on the tenant and the booking
   * id and therefore re-numbers the same predicates. Keeping the arithmetic in
   * one place per query is what stops the two from drifting apart.
   */
  private bookingFilters(
    scope: PanelBookingScope,
    query: SalonPanelBookingsQueryDto | undefined,
    startIso: string | undefined,
    endIso: string | undefined,
    offset: number,
  ): {
    where: string;
    statusWhere: string;
    whereParams: unknown[];
    statusParams: unknown[];
  } {
    // The scope fragment numbers its own params from `$1` (see
    // [PanelBookingScope]); shift every placeholder by `offset` so it lines up
    // with the rest of this query's parameter list. Without this the fragment
    // keeps claiming `$1` in a query that already spends `$1` on the tenant,
    // which both binds the wrong value and makes the bind count disagree with
    // the SQL ("bind message supplies N parameters, but prepared statement
    // requires M").
    const parts: string[] = [
      scope.fragment.replace(/\$(\d+)/g, (_match, digits: string) => `$${Number(digits) + offset}`),
    ];
    const scopeParams: unknown[] = [...scope.params];

    // The window bounds are compared against the slot's own ends rather than
    // folded into `tstzrange($n::timestamptz, upper(b.time_slot), '[)')`. That
    // form builds one range per row, and for a booking that lies entirely
    // before the window its lower bound is greater than its upper, which
    // PostgreSQL rejects outright ("range lower bound must be less than or
    // equal to range upper bound"). The half-open overlap of
    // `[lower(slot), upper(slot))` with `[start, end)` is instead
    // `upper(slot) > start AND lower(slot) < end` — each bound against the
    // opposite edge, since a slot that opens after the window closes, or
    // closes before it opens, does not overlap.
    if (startIso !== undefined) {
      scopeParams.push(startIso);
      parts.push(`upper(b.time_slot) > $${offset + scopeParams.length}::timestamptz`);
    }
    if (endIso !== undefined) {
      scopeParams.push(endIso);
      parts.push(`lower(b.time_slot) < $${offset + scopeParams.length}::timestamptz`);
    }
    if (query?.specialistId !== undefined) {
      scopeParams.push(query.specialistId);
      parts.push(`b.specialist_id = $${offset + scopeParams.length}`);
    }

    const where = parts.join(' AND ');
    // The status predicate is applied to the outer `SELECT` in the list, after
    // the CTE, so it is numbered after everything `where` consumed.
    let statusWhere = 'TRUE';
    const statusParams: unknown[] = [];
    if (query?.status !== undefined) {
      statusParams.push(query.status);
      statusWhere = `sc.status = $${offset + scopeParams.length + statusParams.length}`;
    }
    return { where, statusWhere, whereParams: scopeParams, statusParams };
  }

  /**
   * The window a query asks for, as ISO instants at Tehran midnight.
   *
   * `date` is one day and wins over `from`/`to`; `from`/`to` are inclusive
   * Jalali-calendar day bounds, so `to` becomes the *next* midnight and the
   * overlap test stays half-open. With neither, the list spans all of history,
   * which is why both are optional — a screen that has not picked a day yet
   * should not silently invent one.
   */
  private bookingWindow(query: SalonPanelBookingsQueryDto): {
    startIso: string | undefined;
    endIso: string | undefined;
  } {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const dayStart = (value: string | undefined): Date | undefined =>
      value === undefined ? undefined : startOfTehranDay(new Date(`${value}T00:00:00Z`));

    if (query.date !== undefined) {
      const start = dayStart(query.date)!;
      return {
        startIso: start.toISOString(),
        endIso: new Date(start.getTime() + DAY_MS).toISOString(),
      };
    }

    const from = dayStart(query.from);
    const to = dayStart(query.to);
    return {
      startIso: from?.toISOString(),
      endIso: to === undefined ? undefined : new Date(to.getTime() + DAY_MS).toISOString(),
    };
  }

  private zeroBookingCounts(): SalonBookingCounts {
    return {
      pending: 0,
      confirmed: 0,
      completed: 0,
      reviewed: 0,
      cancelled: 0,
      noShow: 0,
    };
  }

  /**
   * A row as the list shows it. `starts_at`/`ends_at` are ISO instants rather
   * than the stored `tstzrange`, so the app formats them in the salon timezone
   * instead of guessing from the device's.
   */
  private toPanelBookingItem(row: PanelBookingRow): SalonPanelBookingItem {
    return {
      id: row.id,
      status: row.status,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      totalPrice: toNumber(row.total_price) ?? 0,
      depositPaid: toNumber(row.deposit_paid) ?? 0,
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      specialistId: row.specialist_id,
      specialistName: row.specialist_name,
      serviceId: row.service_id,
      serviceName: row.service_name,
      lineId: row.line_id,
      isMobile: row.is_mobile === true,
      customerAddress: row.customer_address,
      customerLatitude: row.customer_latitude,
      customerLongitude: row.customer_longitude,
    };
  }

  /**
   * POST /salon/me/specialists — registers a specialist for the salon.
   *
   * The phone is the join key into `users`: an existing `specialist` user is
   * reused (its display name is refreshed from the form), any other role on
   * the same phone is a 400 — a customer account is never silently
   * repurposed — and a missing user is created with `role = 'specialist'`
   * and this tenant id from the JWT. The specialist row itself lands as
   * `approved`: specialist management is immediate per the approval policy.
   */
  async createPanelSpecialist(
    user: AuthenticatedUser,
    dto: CreateSpecialistPanelDto,
  ): Promise<SalonPanelSpecialistCreated> {
    const tenantId = this.requireStaffTenant(user);
    const result = await this.withPanelTenant(tenantId, async (manager) => {
      const users = await manager.query<Array<{ id: string; role: string }>>(
        `SELECT id, role FROM users WHERE phone = $1`,
        [dto.phone],
      );

      let userId: string;
      const existing = users[0];
      if (existing) {
        if (existing.role !== 'specialist') {
          throw new BadRequestException('ط§غŒظ† ط´ظ…ط§ط±ظ‡ ط¨ط§ ظ†ظ‚ط´ ط¯غŒع¯ط±غŒ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
        }
        const owned = await manager.query<Array<{ id: string }>>(
          `SELECT id FROM specialists WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, existing.id],
        );
        if (owned.length > 0) {
          throw new BadRequestException('ط§غŒظ† ع©ط§ط±ط¨ط± ظ‚ط¨ظ„ط§ظ‹ ط¨ظ‡ ط¹ظ†ظˆط§ظ† ظ…طھط®طµطµ ط¯ط± ط§غŒظ† ط³ط§ظ„ظ† ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
        }
        userId = existing.id;
        // The form is the owner's source of truth for the display name and the
        // portrait. `avatarUrl` is only written when the field was submitted —
        // absent means "left it alone", null means "cleared it".
        if (dto.avatarUrl !== undefined) {
          await manager.query(
            `UPDATE users SET full_name = $2, avatar_url = $3 WHERE id = $1`,
            [existing.id, dto.fullName, dto.avatarUrl],
          );
        } else {
          await manager.query(`UPDATE users SET full_name = $2 WHERE id = $1`, [
            existing.id,
            dto.fullName,
          ]);
        }
      } else {
        try {
          const inserted = await manager.query<Array<{ id: string }>>(
            `INSERT INTO users (tenant_id, phone, full_name, role, is_active, avatar_url)
             VALUES ($1, $2, $3, 'specialist', true, $4)
             RETURNING id`,
            [tenantId, dto.phone, dto.fullName, dto.avatarUrl ?? null],
          );
          userId = inserted[0].id;
        } catch (error) {
          // `users.phone` carries a global unique index (migration
          // 1730000000002); under RLS another tenant's row is invisible to
          // the lookup above, so a cross-tenant collision surfaces here.
          if ((error as { code?: string }).code === '23505') {
            throw new BadRequestException('ط§غŒظ† ط´ظ…ط§ط±ظ‡ ظ‚ط¨ظ„ط§ظ‹ ط¨ط§ ظ†ظ‚ط´ ط¯غŒع¯ط±غŒ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
          }
          throw error;
        }
      }

      const inserted = await manager.query<Array<{ id: string }>>(
        `INSERT INTO specialists (tenant_id, user_id, bio, skills, commission_rate, is_active, status)
         VALUES ($1, $2, $3, $4::jsonb, $5, true, 'approved')
         RETURNING id`,
        [
          tenantId,
          userId,
          dto.bio ?? null,
          JSON.stringify(dto.skills ?? []),
          dto.commissionRate ?? 50,
        ],
      );

      return {
        id: inserted[0].id,
        fullName: dto.fullName,
        phone: dto.phone,
        status: 'approved' as const,
      };
    });
    // Invalidate cache after successful write
    await this.invalidateSpecialistCache(tenantId);
    return result;
  }

  /**
   * PATCH /salon/me/specialists/:id â€” bio, skills and the commission rate
   * apply immediately, and `is_active` toggles the specialist in and out of
   * the public catalogue. Nothing here is approval-gated, so the row is
   * re-affirmed `approved` on every edit: a rejected row the salon corrects
   * goes live at once, per the approval policy.
   *
   * Any edit also stamps `profile_completed = TRUE`: this is the specialist's
   * own onboarding form (`SpecialistProfileSetupScreen` posts here), and the
   * endpoint is the only door that writes a `specialists` profile. A
   * specialist who never submits it keeps the `false` the invite left behind
   * (migration 1730000000033) and stays on the setup screen.
   */
  async updatePanelSpecialist(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateSpecialistPanelDto,
  ): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);

    // Ownership scoping (IDOR): the tenant boundary alone does not settle who
    // may write this row, because a *specialist* is staff too and therefore
    // passes `requireStaffTenant`. Scoped by tenant only, one specialist could
    // rewrite another's bio/skills/commission of the same salon by id — the
    // panel lists every specialist of the salon, so those ids are not secret
    // and this is a real cross-account write. An owner or a line manager
    // manages the whole salon, so only the specialist role is narrowed to the
    // row carrying its own `user_id`; the 404 below is "not yours" as well as
    // "not in your salon".
    const ownRowOnly = user.role === 'specialist';

    const result = await this.withPanelTenant<SalonPanelWriteResult>(tenantId, async (manager) => {
      const rows = await manager.query<Array<{ id: string; user_id: string }>>(
        ownRowOnly
          ? `SELECT id, user_id FROM specialists WHERE tenant_id = $1 AND id = $2 AND user_id = $3`
          : `SELECT id, user_id FROM specialists WHERE tenant_id = $1 AND id = $2`,
        ownRowOnly ? [tenantId, id, user.userId] : [tenantId, id],
      );
      if (rows.length === 0) throw new NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      const sets: string[] = [];
      const params: unknown[] = [tenantId, id];
      const push = (value: unknown): string => {
        params.push(value);
        return `$${params.length}`;
      };
      if (dto.bio !== undefined) sets.push(`bio = ${push(dto.bio)}`);
      if (dto.skills !== undefined) sets.push(`skills = ${push(JSON.stringify(dto.skills))}::jsonb`);
      if (dto.commissionRate !== undefined) {
        sets.push(`commission_rate = ${push(dto.commissionRate)}`);
      }
      if (dto.isActive !== undefined) sets.push(`is_active = ${push(dto.isActive)}`);
      if (dto.offersMobileService !== undefined) {
        sets.push(`offers_mobile_service = ${push(dto.offersMobileService)}`);
      }
      if (dto.workingHours !== undefined) {
        sets.push(`working_hours = ${push(JSON.stringify(dto.workingHours))}::jsonb`);
      }

      // The ownership term on the write itself too, so the guard does not rest
      // on the SELECT above alone. `push` appends the value and hands back its
      // placeholder, which lands after every dto-driven `$n` above.
      const ownershipTerm = ownRowOnly ? ` AND user_id = ${push(user.userId)}` : '';

      await manager.query(
        `UPDATE specialists
            SET ${sets.length > 0 ? `${sets.join(', ')}, ` : ''}
                status = 'approved',
                profile_completed = TRUE
          WHERE tenant_id = $1 AND id = $2${ownershipTerm}`,
        params,
      );
      // The portrait lives on the `users` row, not the specialist row, so it has
      // its own write. Skipped when the field was not submitted: absent means
      // unchanged, null means the salon removed the picture.
      if (dto.avatarUrl !== undefined) {
        await manager.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [
          dto.avatarUrl,
          rows[0].user_id,
        ]);
      }

      return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
    });
    // Invalidate cache after successful write
    await this.invalidateSpecialistCache(tenantId);
    return result;
  }

  /**
   * DELETE /salon/me/specialists/:id â€” soft delete (`is_active = false`),
   * blocked while the specialist still carries an active booking so a salon
   * cannot orphan a customer's reservation by hiding its specialist. The
   * "active" set is the same predicate `deleteServiceLine` uses.
   */
  async deletePanelSpecialist(user: AuthenticatedUser, id: string): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withPanelTenant(tenantId, async (manager) => {
      const rows = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      if (rows.length === 0) throw new NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      const bookings = await manager.query<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count
           FROM bookings b
          WHERE b.specialist_id = $1 AND ${ACTIVE_BOOKING_STATUSES}`,
        [id],
      );
      if ((bookings[0]?.count ?? 0) > 0) {
        throw new BadRequestException('ط§غŒظ† ظ…طھط®طµطµ ط±ط²ط±ظˆ ظپط¹ط§ظ„ ط¯ط§ط±ط¯');
      }

      await manager.query(
        `UPDATE specialists SET is_active = false WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
    });
  }

  /**
   * `GET /salon/me/specialists/:id/services` — the services the salon assigned
   * to one specialist, inactive assignments included (the owner can switch
   * those back on). A specialist sees only their own row: the panel lists every
   * specialist id of the salon, so reading another specialist's id by hand is a
   * real cross-account read and answers 403, per the charter.
   */
  async listPanelSpecialistServices(
    user: AuthenticatedUser,
    specialistId: string,
  ): Promise<SalonSpecialistServiceItem[]> {
    const tenantId = this.requireStaffTenant(user);
    const ownRowOnly = user.role === 'specialist';

    return this.withPanelTenant(tenantId, async (manager) => {
      if (ownRowOnly) {
        const owned = await manager.query<Array<{ id: string }>>(
          `SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2 AND user_id = $3`,
          [tenantId, specialistId, user.userId],
        );
        if (owned.length === 0) {
          throw new ForbiddenException('مشاهده خدمات متخصصان دیگر مجاز نیست');
        }
      } else {
        const specs = await manager.query<Array<{ id: string }>>(
          `SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2`,
          [tenantId, specialistId],
        );
        if (specs.length === 0) throw new NotFoundException('متخصص مورد نظر یافت نشد');
      }

      return this.selectPanelSpecialistServices(manager, tenantId, specialistId);
    });
  }

  /**
   * `PUT /salon/me/specialists/:id/services` — the owner defines which services
   * a specialist offers. Salon-owner only: a specialist editing their own
   * assignments would be deciding their own catalogue, which is the salon's
   * call, not the provider's.
   *
   * The list is replacing, not merging: services missing from it are
   * un-assigned, the ones in it are upserted. Every service id must belong to
   * the same tenant — an id from another salon is a 400 rather than a silently
   * accepted assignment.
   */
  async setPanelSpecialistServices(
    user: AuthenticatedUser,
    specialistId: string,
    dto: SetSpecialistServicesDto,
  ): Promise<SalonSpecialistServiceItem[]> {
    const tenantId = this.requireStaffTenant(user);
    if (user.role !== 'salon_owner' && user.role !== 'admin') {
      throw new ForbiddenException('تعریف خدمات متخصص تنها توسط سالن‌دار امکان‌پذیر است');
    }

    return this.withPanelTenant(tenantId, async (manager) => {
      const specs = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2`,
        [tenantId, specialistId],
      );
      if (specs.length === 0) throw new NotFoundException('متخصص مورد نظر یافت نشد');

      const uniqueIds = [...new Set(dto.services.map((item) => item.serviceId))];
      if (uniqueIds.length > 0) {
        const valid = await manager.query<Array<{ id: string }>>(
          `SELECT id FROM services WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
          [tenantId, uniqueIds],
        );
        if (valid.length !== uniqueIds.length) {
          throw new BadRequestException('یک یا چند خدمت متعلق به این سالن نیست');
        }
      }

      await manager.query(
        `DELETE FROM specialist_services
          WHERE tenant_id = $1 AND specialist_id = $2
            AND NOT (service_id = ANY($3::uuid[]))`,
        [tenantId, specialistId, uniqueIds],
      );
      for (const item of dto.services) {
        await manager.query(
          `INSERT INTO specialist_services (tenant_id, specialist_id, service_id, is_active, created_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, specialist_id, service_id)
           DO UPDATE SET is_active = EXCLUDED.is_active`,
          [tenantId, specialistId, item.serviceId, item.isActive ?? true, user.userId],
        );
      }

      return this.selectPanelSpecialistServices(manager, tenantId, specialistId);
    });
  }

  /** The shared `specialist_services` join of the two panel endpoints above. */
  private async selectPanelSpecialistServices(
    manager: EntityManager,
    tenantId: string,
    specialistId: string,
  ): Promise<SalonSpecialistServiceItem[]> {
    const rows = await manager.query<PanelSpecialistServiceRow[]>(
      `SELECT ss.id, ss.specialist_id, ss.service_id, sv.name, sv.description,
              COALESCE(ss.price, sv.price) AS price,
              COALESCE(ss.duration_minutes, sv.duration_minutes) AS duration_minutes,
              ss.is_active, sv.is_mobile_available
         FROM specialist_services ss
         JOIN services sv ON sv.id = ss.service_id
        WHERE ss.tenant_id = $1 AND ss.specialist_id = $2
        ORDER BY sv.name ASC, ss.id ASC`,
      [tenantId, specialistId],
    );
    return rows.map((row) => this.toSpecialistServiceItem(row));
  }

  private toSpecialistServiceItem(row: PanelSpecialistServiceRow): SalonSpecialistServiceItem {
    return {
      id: row.id,
      specialistId: row.specialist_id,
      serviceId: row.service_id,
      name: row.name,
      description: row.description,
      price: toNumber(row.price) ?? 0,
      durationMinutes: row.duration_minutes ?? 0,
      isActive: row.is_active === true,
      isMobileAvailable: row.is_mobile_available === true,
    };
  }


  /**
   * GET /salon/me/portfolio â€” every portfolio photo of every specialist of
   * the signed-in salon, flattened exactly like the public lookup
   * (migration 1730000000016): bare-string and object elements both
   * accepted, an element's own `id`/`imageId` used when it is a uuid and a
   * position-derived key otherwise. Inactive specialists are included â€” the
   * panel manages them too â€” and `createdAt` comes from the element when it
   * carries one, falling back to the specialist row's creation time.
   */
  async listPanelPortfolio(user: AuthenticatedUser): Promise<SalonPanelPortfolio> {
    const tenantId = this.requireStaffTenant(user);
    const rows = await this.withPanelTenant(tenantId, (manager) =>
      manager.query<PanelPortfolioRow[]>(
        `SELECT CASE
                   WHEN COALESCE(img.item ->> 'id', img.item ->> 'imageId') ~
                        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                     THEN COALESCE(img.item ->> 'id', img.item ->> 'imageId')
                   -- ::uuid::text so the derived key comes back in the same
                   -- dashed form as an element's own id, which is what
                   -- ParseUUIDPipe expects when the panel sends it back to
                   -- DELETE /salon/me/portfolio/:id.
                   ELSE md5(sp.id::text || ':portfolio:' || img.ord::text)::uuid::text
                 END AS id,
                 CASE
                   WHEN jsonb_typeof(img.item) = 'string' THEN img.item #>> '{}'
                   ELSE COALESCE(
                     img.item ->> 'url',
                     img.item ->> 'image_url',
                     img.item ->> 'src'
                   )
                 END AS image_url,
                 sp.id AS specialist_id,
                 u.full_name AS specialist_name,
                 img.item ->> 'createdAt' AS element_created_at,
                 sp.created_at AS specialist_created_at
           FROM specialists sp
           LEFT JOIN users u ON u.id = sp.user_id
           CROSS JOIN LATERAL jsonb_array_elements(
             CASE
               WHEN jsonb_typeof(sp.portfolio_images) = 'array' THEN sp.portfolio_images
               ELSE '[]'::jsonb
             END
           ) WITH ORDINALITY AS img(item, ord)
          WHERE sp.tenant_id = $1
            AND length(btrim(COALESCE(
                  CASE
                    WHEN jsonb_typeof(img.item) = 'string' THEN img.item #>> '{}'
                    ELSE COALESCE(
                      img.item ->> 'url',
                      img.item ->> 'image_url',
                      img.item ->> 'src'
                    )
                  END,
                  ''
                ))) > 0
          ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC, img.ord ASC`,
        [tenantId],
      ),
    );

    return {
      data: rows.map((row) => {
        const fromElement = Date.parse(row.element_created_at ?? '');
        return {
          id: row.id,
          imageUrl: row.image_url,
          specialistId: row.specialist_id,
          specialistName: row.specialist_name,
          createdAt: Number.isNaN(fromElement)
            ? row.specialist_created_at.toISOString()
            : new Date(fromElement).toISOString(),
        };
      }),
    };
  }

  /**
   * POST /salon/me/portfolio â€” appends one photo to a specialist's
   * `portfolio_images`. The element is stored as an object with a stable
   * uuid `id` and the upload instant (both understood by the public lookup),
   * and the tenant flips to `pending_approval` because the gallery is part
   * of the public profile â€” an admin reviews the salon as a whole.
   */
  async addPanelPortfolioItem(
    user: AuthenticatedUser,
    dto: AddPortfolioItemDto,
  ): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withPanelTenant(tenantId, async (manager) => {
      const specs = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2`,
        [tenantId, dto.specialistId],
      );
      if (specs.length === 0) throw new NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      const element = JSON.stringify({
        id: randomUUID(),
        url: dto.imageUrl,
        createdAt: new Date().toISOString(),
      });
      await manager.query(
        `UPDATE specialists
            SET portfolio_images = COALESCE(portfolio_images, '[]'::jsonb)
                || jsonb_build_array($3::jsonb)
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, dto.specialistId, element],
      );
      return this.stagePortfolioReview(manager, tenantId);
    });
  }

  /**
   * DELETE /salon/me/portfolio/:id â€” removes one photo. The id may be the
   * element's own uuid or the position-derived key the listing hands out, so
   * both an element written by this endpoint and one seeded as a bare string
   * can be deleted. The tenant flips to `pending_approval` exactly like an
   * addition.
   */
  async deletePanelPortfolioItem(user: AuthenticatedUser, id: string): Promise<SalonPanelWriteResult> {
    const tenantId = this.requireStaffTenant(user);
    return this.withPanelTenant(tenantId, async (manager) => {
      const specs = await manager.query<Array<{ id: string; portfolio_images: unknown }>>(
        `SELECT id, portfolio_images FROM specialists WHERE tenant_id = $1`,
        [tenantId],
      );

      const target = id.toLowerCase().replaceAll('-', '');
      let removed = false;
      for (const spec of specs) {
        const images = Array.isArray(spec.portfolio_images) ? spec.portfolio_images : [];
        const index = images.findIndex(
          (element, position) =>
            portfolioElementId(spec.id, position, element).toLowerCase().replaceAll('-', '') ===
            target,
        );
        if (index === -1) continue;
        images.splice(index, 1);
        await manager.query(
          `UPDATE specialists SET portfolio_images = $3::jsonb WHERE tenant_id = $1 AND id = $2`,
          [tenantId, spec.id, JSON.stringify(images)],
        );
        removed = true;
        break;
      }
      if (!removed) throw new NotFoundException('ظ†ظ…ظˆظ†ظ‡â€Œع©ط§ط± ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');

      return this.stagePortfolioReview(manager, tenantId);
    });
  }

  /**
   * The tenant-level flip every portfolio write performs. Portfolio writes
   * carry no `pending_changes` field of their own â€” the photo change is
   * already visible in the gallery â€” so this mirrors only the status half of
   * [stagePendingChanges]: mark the salon as awaiting review and drop the
   * decision the new submission supersedes.
   */
  private async stagePortfolioReview(
    manager: EntityManager,
    tenantId: string,
  ): Promise<SalonPanelWriteResult> {
    await manager.query(
      `UPDATE tenants
          SET status = 'pending_approval',
              rejection_reason = NULL
        WHERE id = $1`,
      [tenantId],
    );
    return { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE };
  }

  /** Tenant of a staff request, or the charter's 404 when the token has none. */
  private requireStaffTenant(user: AuthenticatedUser): string {
    if (!user || !STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('ط§غŒظ† ط¨ط®ط´ ظپظ‚ط· ط¨ط±ط§غŒ ظ¾ط±ط³ظ†ظ„ ط³ط§ظ„ظ† ط§ط³طھ');
    }
    if (!user.tenantId) throw new NotFoundException('ط¨ظ‡ ط³ط§ظ„ظ†غŒ ظ…طھطµظ„ ظ†غŒط³طھغŒط¯');
    return user.tenantId;
  }

  /**
   * The actor of a schedule-block request.
   *
   * Salon staff act through their token tenant; a mobile specialist has none
   * and acts through the `specialists` row that belongs to them. Anything
   * else — a customer, or a caller whose mobile profile does not exist — is
   * refused before any SQL reaches the table.
   */
  private async blockScope(user: AuthenticatedUser): Promise<BlockScope> {
    if (!user) {
      throw new ForbiddenException('این بخش فقط برای پرسنل سالن است');
    }
    if (MOBILE_SPECIALIST_ROLES.has(user.role)) {
      const rows = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM specialists WHERE user_id = $1 AND is_active = true`,
        [user.userId],
      );
      const specialistId = rows[0]?.id;
      if (!specialistId) {
        throw new NotFoundException('پروفایل متخصص سیار شما یافت نشد');
      }
      // shortcut: one mobile specialist owns one active specialists row
      // (admin provisioning, migration 1792700000000); a second row would
      // need a calendar picker here, not just the first match.
      return { tenantId: null, specialistId, userId: user.userId, blockAsSpecialist: true };
    }
    const tenantId = this.requireStaffTenant(user);
    return { tenantId, specialistId: null, userId: null, blockAsSpecialist: false };
  }

  /**
   * Resolves which specialist a block belongs to and rejects any id the
   * caller cannot touch: staff may only block a specialist of their own
   * salon, a mobile specialist only themselves.
   */
  private async assertBlockTarget(
    scope: BlockScope,
    requestedId: string | undefined,
  ): Promise<string | null> {
    if (scope.blockAsSpecialist) {
      return scope.specialistId;
    }
    if (!requestedId) return null;

    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM specialists WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [requestedId, scope.tenantId!],
    );
    if (rows.length === 0) {
      throw new BadRequestException('این متخصص متعلق به سالن شما نیست');
    }
    return requestedId;
  }

  /** `withTenant`/`withPanelTenant` counterpart for the block endpoints. */
  private withBlockScope<T>(
    scope: BlockScope,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      if (scope.tenantId) {
        await setTenantContext(manager, scope.tenantId);
      } else {
        await setUserContext(manager, scope.userId!);
      }
      return work(manager);
    });
  }

  private toScheduleBlockItem(row: ScheduleBlockRow): SalonScheduleBlockItem {
    return {
      id: row.id,
      specialistId: row.specialist_id,
      salonId: row.tenant_id,
      // Stored as an instant; the panel renders the Jalali calendar day.
      date: new Date(row.start_time).toISOString().slice(0, 10),
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason,
    };
  }

  /**
   * Active specialists of one salon, joined with the user row that carries the
   * display name and avatar. Read through get_public_salon_specialists() because
   * `users` is FORCE ROW LEVEL SECURITY and this public feed has no tenant
   * context, so a plain JOIN would come back with empty names (see migration
   * 1730000000015).
   */
  private async loadSpecialists(salonId: string): Promise<SalonSpecialist[]> {
    // ADR-011: `get_public_salon_specialists()` is deliberately NOT redefined
    // to carry the mobile flag (migration 1730000000016 pins its RETURNS TABLE
    // shape and every caller that depends on it), so the flag is joined in from
    // `specialists`. That table carries no RLS policy, unlike `users`, so a
    // public connection can read it directly — one round trip instead of two
    // keeps the salon detail inside its five-query budget.
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        skills: string[];
        commission_rate: string | null;
        offers_mobile_service: boolean | null;
      }>
    >(
      `SELECT sp.id, sp.full_name, sp.avatar_url, sp.bio, sp.skills, sp.commission_rate,
              s.offers_mobile_service
       FROM get_public_salon_specialists($1::uuid) sp
       LEFT JOIN specialists s ON s.id = sp.id`,
      [salonId],
    );

    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      skills: row.skills ?? [],
      commissionRate: toNumber(row.commission_rate) ?? 0,
      offersMobileService: row.offers_mobile_service === true,
    }));
  }

  private toListItem(row: SalonRow, tags: string[], now: Date): SalonListItem {
    return {
      id: row.id,
      name: row.name,
      specialty: row.category_name ?? '',
      coverImage: row.cover_image_url,
      address: row.address,
      rating: toNumber(row.rating) ?? 0,
      reviewCount: row.review_count ?? 0,
      distanceKm: toNumber(row.distance_km),
      discountPercent: row.discount_percent,
      minPrice: toNumber(row.min_price),
      tags,
      isOpenNow: isSalonOpenNow(row.working_hours, now),
    };
  }
}

/** Weights as stored and echoed back, always summing to 1. */
export interface NormalisedWeights {
  distance: number;
  price: number;
  rating: number;
  discount: number;
}

const DEFAULT_WEIGHTS: NormalisedWeights = { distance: 0.3, price: 0.3, rating: 0.3, discount: 0.1 };

/**
 * Fills the gaps with the charter's default split and rescales so the four
 * values sum to 1. A caller sending 10/10/10/10 gets the same 25% each.
 */
function normaliseWeights(input?: Partial<NormalisedWeights>): NormalisedWeights {
  const raw: NormalisedWeights = {
    distance: positive(input?.distance) ?? DEFAULT_WEIGHTS.distance,
    price: positive(input?.price) ?? DEFAULT_WEIGHTS.price,
    rating: positive(input?.rating) ?? DEFAULT_WEIGHTS.rating,
    discount: positive(input?.discount) ?? DEFAULT_WEIGHTS.discount,
  };
  const total = raw.distance + raw.price + raw.rating + raw.discount;
  if (total <= 0) return DEFAULT_WEIGHTS;
  return {
    distance: raw.distance / total,
    price: raw.price / total,
    rating: raw.rating / total,
    discount: raw.discount / total,
  };
}

function positive(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Ranks the rows by a weighted sum of per-criterion scores in 0â€“1.
 *
 * Distance, price and discount are inverted (lower is better) and normalised
 * against the best and worst value in the set. A criterion with a single
 * distinct value contributes a constant, which is harmless. A criterion with no
 * usable value at all (no coordinates, so every distance is null) scores 0 and
 * effectively drops out.
 */
function sortByWeightedScore(
  items: SalonListItem[],
  weights: NormalisedWeights,
): SalonListItem[] {
  if (items.length === 0) return items;

  const distances = items.map((item) => item.distanceKm).filter(isFiniteNumber);
  const prices = items.map((item) => item.minPrice).filter(isFiniteNumber);
  const ratings = items.map((item) => item.rating).filter(isFiniteNumber);
  const discounts = items.map((item) => item.discountPercent ?? 0);

  const distanceScale = invertedScale(distances);
  const priceScale = invertedScale(prices);
  const ratingScale = ascendingScale(ratings);
  const discountScale = ascendingScale(discounts);

  const score = (item: SalonListItem): number =>
    weights.distance * distanceScale(item.distanceKm) +
    weights.price * priceScale(item.minPrice) +
    weights.rating * ratingScale(item.rating) +
    weights.discount * discountScale(item.discountPercent ?? 0);

  // Ties fall back to the existing list ordering so results stay stable.
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 0â€“1 where the smallest value scores 1. */
function invertedScale(values: number[]): (value: number | null) => number {
  const [min, max] = bounds(values);
  if (min === null || max === null) return () => 0;
  if (max === min) return () => 1;
  return (value) => (isFiniteNumber(value) ? 1 - (value - min) / (max - min) : 0);
}

/** 0â€“1 where the largest value scores 1. */
function ascendingScale(values: number[]): (value: number | null) => number {
  const [min, max] = bounds(values);
  if (min === null || max === null) return () => 0;
  if (max === min) return () => 1;
  return (value) => (isFiniteNumber(value) ? (value - min) / (max - min) : 0);
}

function bounds(values: number[]): [number | null, number | null] {
  if (values.length === 0) return [null, null];
  return [Math.min(...values), Math.max(...values)];
}

/**
 * Is the salon serving right now?
 *
 * The schedule itself is read by `working-hours.util`: a day with `active: false`,
 * the legacy `closed: true`, a missing/invalid time, or no entry for today is
 * closed. A window whose `end` is not after its `start` runs past midnight
 * (`20:00`â€“`02:00`). The clock is always Tehran, never the server's own zone, so
 * a UTC container still reports the local business hours.
 */
export function isSalonOpenNow(
  workingHours: Record<string, unknown> | null,
  now: Date = new Date(),
): boolean {
  const day = dayWindow(workingHours, dayKeyForInstant(now));
  return day !== null && withinWindow(day, minutesSinceMidnight(now));
}

/** `YYYY-MM-DD` from the query string as a calendar day, or a 400. */
function parseCivilDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  // The round trip only holds for a real date, so 2026-02-30 is rejected here
  // rather than by PostgreSQL.
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new BadRequestException('طھط§ط±غŒط® ظˆط§ط±ط¯â€Œط´ط¯ظ‡ ظ…ط¹طھط¨ط± ظ†غŒط³طھ');
  }
  return { year, month, day };
}
/** Milliseconds in one day, used to close the half-open "today" window. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Roles that may read the salon panel. Customers have no tenant and are 403.
 *
 * `specialist`, `employed` and `booth_renter` all staff a salon (the latter
 * two are the ADR-003 specialist kinds the admin panel manages), so they
 * enter through the same staff gate. `freelance_mobile` is salon-independent
 * (ADR-011 mobile service) and reaches only the schedule-block routes, whose
 * `blockScope` resolves them through their own `specialists` row instead of
 * a tenant.
 */
const STAFF_ROLES = new Set<string>([
  'salon_owner',
  'line_manager',
  'specialist',
  'employed',
  'booth_renter',
  'admin',
]);

/**
 * Roles that act on the schedule as an *independent specialist* rather than
 * as salon staff: they have no `tenantId` in the token (mobile, ADR-011), so
 * their writes are scoped to the `specialists` row that points back at them.
 */
const MOBILE_SPECIALIST_ROLES = new Set<string>(['freelance_mobile']);

/** Who is acting in a schedule-block request, and on whose calendar. */
interface BlockScope {
  /**
   * The salon the block is written into. `null` for a mobile specialist,
   * whose block carries `schedule_blocks.tenant_id IS NULL`.
   */
  tenantId: string | null;
  /** The mobile caller's own `specialists.id`; `null` for salon staff. */
  specialistId: string | null;
  /** The mobile caller's `users.id`, which their RLS branch keys on. */
  userId: string | null;
  /** True when the caller acts as a mobile specialist, not as salon staff. */
  blockAsSpecialist: boolean;
}

/** Raw `schedule_blocks` row behind [SalonScheduleBlockItem]. */
interface ScheduleBlockRow {
  id: string;
  tenant_id: string | null;
  specialist_id: string | null;
  start_time: Date;
  end_time: Date;
  reason: string | null;
}

/** Bookings that count toward the dashboard's booking totals. */
const ACTIVE_BOOKING_STATUSES = `b.status IN ('pending', 'confirmed', 'completed')`;

/** Raw row behind [SalonPanelSpecialistItem]. */
interface PanelSpecialistRow {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  skills: string[] | null;
  commission_rate: string | null;
  is_active: boolean;
  offers_mobile_service: boolean;
  bookings_count: number;
}

/** Raw row behind one flattened photo of [SalonPanelPortfolio]. */
interface PanelPortfolioRow {
  id: string;
  /** Never null â€” the WHERE clause keeps only elements with a usable URL. */
  image_url: string;
  specialist_id: string;
  specialist_name: string | null;
  element_created_at: string | null;
  specialist_created_at: Date;
}

/** Raw row behind [SalonSpecialistServiceItem]; numerics arrive as strings. */
interface PanelSpecialistServiceRow {
  id: string;
  specialist_id: string;
  service_id: string;
  name: string;
  description: string | null;
  price: string;
  duration_minutes: number;
  is_active: boolean;
  is_mobile_available: boolean;
}

/**
 * Raw row behind [SalonPanelBookingItem].
 *
 * `starts_at`/`ends_at` come back as `lower()`/`upper()` of the range, cast to
 * timestamptz, so they are real `Date`s and not strings. `total_price` is left
 * as the numeric string `pg` returns; the JSON serialisation of a `Number(...)`
 * keeps the money formatting the rest of the app already uses.
 */
interface PanelBookingRow {
  id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  total_price: string | number;
  deposit_paid: string | number;
  notes: string | null;
  created_at: Date;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  specialist_id: string;
  specialist_name: string | null;
  service_id: string | null;
  service_name: string | null;
  line_id: string | null;
  /** ADR-011: on-site flag and the address/coordinates of the visit. */
  is_mobile: boolean;
  customer_address: string | null;
  customer_latitude: string | number | null;
  customer_longitude: string | number | null;
}

/** The tenant's `working_hours` and `settings`, only needed by the detail. */
interface PanelBookingTenantRow {
  working_hours: unknown;
  settings: unknown;
}

/**
 * The SQL fragment a caller's role may see, as passed to [bookingFilters].
 *
 * `fragment` is a WHERE predicate over the aliases the booking queries use
 * (`b` for bookings, `sv` for services) and `params` are its bound values,
 * numbered from `$1` — [bookingFilters] offsets them for each query, so the
 * same scope object serves both the list and the single-row read.
 *
 * `fragment: 'FALSE'` is how a profile that resolves to no scope (a
 * specialist with no `specialists` row, a line manager with no active lines)
 * gets an empty result rather than a tenant-wide one.
 */
interface PanelBookingScope {
  fragment: string;
  params: unknown[];
}

const UUID_ELEMENT_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * The element id of one `portfolio_images` entry, position included â€” the
 * same derivation `get_public_salon_portfolio()` applies (migration
 * 1730000000016): the element's own `id`/`imageId` when that is a uuid,
 * otherwise md5(specialistId:portfolio:position). `md5(...)::uuid` in
 * Postgres accepts the bare 32-hex digest, so this returns the digest without
 * dashes and callers compare after stripping dashes from both sides.
 */
function portfolioElementId(specialistId: string, position: number, element: unknown): string {
  if (element !== null && typeof element === 'object') {
    const record = element as Record<string, unknown>;
    const ownId = record.id ?? record.imageId;
    if (typeof ownId === 'string' && UUID_ELEMENT_PATTERN.test(ownId)) return ownId;
  }
  return createHash('md5').update(`${specialistId}:portfolio:${position}`).digest('hex');
}

/** Bookings whose money has actually been earned (revenue). */
const REVENUE_STATUSES = `b.status IN ('confirmed', 'completed')`;

/**
 * Appends the specialist filter parameter when a specialist is signed in.
 * The tenant scope is the RLS setting, so it is never a query parameter.
 */
function withSpecialistId(params: unknown[], specialistId: string | null): unknown[] {
  return specialistId ? [...params, specialistId] : params;
}

/**
 * Turns the per-day rows into a fixed 7-bar series, Saturday (0) through
 * Friday (6). Days with no revenue are filled with 0 so the chart always has
 * the same shape.
 */
function buildWeeklyRevenue(rows: SalonDashboardDayRow[]): SalonDashboardDayRevenue[] {
  const byDay = new Map<number, number>();
  for (const row of rows) {
    byDay.set(row.day_index, toNumber(row.amount) ?? 0);
  }
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    amount: byDay.get(dayIndex) ?? 0,
  }));
}
