"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalonService = void 0;
exports.isSalonOpenNow = isSalonOpenNow;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const node_crypto_1 = require("node:crypto");
const typeorm_1 = require("typeorm");
const jalali_date_util_1 = require("../../utils/jalali-date.util");
const working_hours_util_1 = require("../../utils/working-hours.util");
const domain_events_1 = require("../../common/domain-events");
const salon_bookings_query_dto_1 = require("./dto/salon-bookings-query.dto");
const salon_query_dto_1 = require("./dto/salon-query.dto");
const TAG_LIMIT = 3;
const MAX_LIMIT = 50;
const PENDING_APPROVAL_MESSAGE = 'ط¯ط± ط§ظ†طھط¸ط§ط± طھط§غŒغŒط¯ ط§ط¯ظ…غŒظ†';
function affectedRows(result) {
    if (!Array.isArray(result))
        return undefined;
    const count = result[1];
    return typeof count === 'number' ? count : undefined;
}
const PUBLIC_SALON_SQL = "t.approved_at IS NOT NULL AND t.status <> 'suspended'";
const PUBLIC_TENANT_SQL = "approved_at IS NOT NULL AND status <> 'suspended'";
const toNumber = (value) => {
    if (value === null || value === undefined || value === '')
        return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
let SalonService = class SalonService {
    dataSource;
    events;
    constructor(dataSource, events) {
        this.dataSource = dataSource;
        this.events = events;
    }
    async list(query) {
        const page = Math.max(Math.trunc(query.page) || 1, 1);
        const limit = Math.min(Math.max(Math.trunc(query.limit) || 20, 1), MAX_LIMIT);
        const offset = (page - 1) * limit;
        const categorySlug = query.category ?? query.categorySlug;
        const sort = query.sort ?? salon_query_dto_1.SalonSort.Rating;
        const coords = query.lat !== undefined && query.lng !== undefined
            ? { lat: query.lat, lng: query.lng }
            : undefined;
        const params = [];
        const bind = (value) => {
            params.push(value);
            return `$${params.length}`;
        };
        const where = ['t.is_active = true', PUBLIC_SALON_SQL];
        if (categorySlug)
            where.push(`c.slug = ${bind(categorySlug)}`);
        const whereParams = [...params];
        const whereSql = where.join(' AND ');
        const distanceSelect = this.buildDistanceSelect(coords, bind);
        const orderByMap = {
            [salon_query_dto_1.SalonSort.Distance]: 'distance_km NULLS LAST, t.rating DESC, t.review_count DESC, t.id',
            [salon_query_dto_1.SalonSort.Rating]: 't.rating DESC, t.review_count DESC, t.id',
            [salon_query_dto_1.SalonSort.Price]: 'min_price NULLS LAST, t.rating DESC, t.id',
            [salon_query_dto_1.SalonSort.Newest]: 't.created_at DESC, t.id',
        };
        const orderBy = sort === salon_query_dto_1.SalonSort.Distance && !coords
            ? orderByMap[salon_query_dto_1.SalonSort.Rating]
            : orderByMap[sort];
        const rows = await this.dataSource.query(`WITH price_agg AS (
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
       LIMIT ${bind(limit)} OFFSET ${bind(offset)}`, params);
        const [countRow] = await this.dataSource.query(`SELECT COUNT(*)::int AS total
       FROM tenants t
       LEFT JOIN service_categories c ON c.id = t.category_id
       WHERE ${whereSql}`, whereParams);
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
    async match(dto) {
        const requested = dto.limit ?? 20;
        const limit = Math.min(Math.max(Math.trunc(requested) || 20, 1), MAX_LIMIT);
        const params = [];
        const bind = (value) => {
            params.push(value);
            return `$${params.length}`;
        };
        const weights = normaliseWeights(dto.sortWeights ?? dto.weights);
        const coords = dto.lat !== undefined && dto.lng !== undefined ? { lat: dto.lat, lng: dto.lng } : undefined;
        const where = ['t.is_active = true', PUBLIC_SALON_SQL];
        if (dto.categorySlug)
            where.push(`c.slug = ${bind(dto.categorySlug)}`);
        if (dto.minRating !== undefined)
            where.push(`t.rating >= ${bind(dto.minRating)}`);
        if (dto.onlyDiscounted)
            where.push(`t.discount_percent IS NOT NULL AND t.discount_percent > 0`);
        const outer = [];
        if (dto.maxDistanceKm !== undefined) {
            outer.push(`distance_km IS NOT NULL AND distance_km <= ${bind(dto.maxDistanceKm)}`);
        }
        if (dto.maxPrice !== undefined) {
            outer.push(`min_price IS NOT NULL AND min_price <= ${bind(dto.maxPrice)}`);
        }
        const rows = await this.dataSource.query(`SELECT * FROM (
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
       ${outer.length ? `WHERE ${outer.join(' AND ')}` : ''}`, params);
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
    async listCategories() {
        const rows = await this.dataSource.query(`SELECT id, name, slug, icon, emoji, sort_order
       FROM service_categories
       WHERE is_active = true
       ORDER BY sort_order, name`);
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
    async findOne(id, query) {
        const params = [id];
        const bind = (value) => {
            params.push(value);
            return `$${params.length}`;
        };
        const coords = query.lat !== undefined && query.lng !== undefined
            ? { lat: query.lat, lng: query.lng }
            : undefined;
        const [row] = await this.dataSource.query(`SELECT t.id, t.name, t.name_en, t.slug, t.address, t.phone, t.cover_image_url,
              t.discount_percent,
              c.name AS category_name, t.rating, t.review_count,
              t.working_hours, t.settings, t.latitude, t.longitude,
              (SELECT MIN(s.price) FROM services s WHERE s.tenant_id = t.id) AS min_price,
              ${this.buildDistanceSelect(coords, bind)}
       FROM tenants t
       LEFT JOIN service_categories c ON c.id = t.category_id
       WHERE t.id = $1 AND t.is_active = true AND ${PUBLIC_SALON_SQL}`, params);
        if (!row)
            throw new common_1.NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
        const serviceRows = await this.dataSource.query(`SELECT id, name, description, price
       FROM services
       WHERE tenant_id = $1
       ORDER BY price ASC, name ASC`, [id]);
        const tags = await this.loadTags([id]);
        const now = new Date();
        return {
            ...this.toListItem(row, tags.get(id) ?? [], now),
            nameEn: row.name_en,
            slug: row.slug,
            phone: row.phone,
            latitude: toNumber(row.latitude),
            longitude: toNumber(row.longitude),
            workingHours: row.working_hours ?? {},
            settings: row.settings ?? {},
            services: serviceRows.map((service) => ({
                id: service.id,
                name: service.name,
                description: service.description,
                price: toNumber(service.price) ?? 0,
            })),
            specialists: await this.loadSpecialists(id),
            portfolio: await this.loadPortfolio(id),
        };
    }
    async specialists(id) {
        const [tenant] = await this.dataSource.query(`SELECT id FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`, [id]);
        if (!tenant)
            throw new common_1.NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
        return { data: await this.loadSpecialists(id) };
    }
    async portfolio(id) {
        const [tenant] = await this.dataSource.query(`SELECT id FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`, [id]);
        if (!tenant)
            throw new common_1.NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
        return { data: await this.loadPortfolio(id) };
    }
    async loadPortfolio(salonId) {
        const rows = await this.dataSource.query(`SELECT id, image_url, specialist_id, specialist_name
       FROM get_public_salon_portfolio($1::uuid)`, [salonId]);
        return rows.map((row) => ({
            id: row.id,
            imageUrl: row.image_url,
            specialistId: row.specialist_id,
            specialistName: row.specialist_name,
        }));
    }
    buildDistanceSelect(coords, bind) {
        if (!coords)
            return 'NULL::numeric AS distance_km';
        const latPh = bind(coords.lat);
        const lngPh = bind(coords.lng);
        const haversine = `6371 * acos(LEAST(1, GREATEST(-1, ` +
            `COS(RADIANS(${latPh})) * COS(RADIANS(t.latitude))` +
            ` * COS(RADIANS(t.longitude) - RADIANS(${lngPh}))` +
            ` + SIN(RADIANS(${latPh})) * SIN(RADIANS(t.latitude)))))`;
        return (`CASE WHEN t.latitude IS NOT NULL AND t.longitude IS NOT NULL ` +
            `THEN ROUND((${haversine})::numeric, 1) END AS distance_km`);
    }
    async availableSlots(id, query) {
        const date = parseCivilDate(query.date);
        const [tenant] = await this.dataSource.query(`SELECT working_hours FROM tenants WHERE id = $1 AND is_active = true AND ${PUBLIC_TENANT_SQL}`, [id]);
        if (!tenant)
            throw new common_1.NotFoundException('ط³ط§ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
        const [service] = await this.dataSource.query(`SELECT duration_minutes
       FROM services
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`, [query.serviceId, id]);
        if (!service)
            throw new common_1.NotFoundException('ط®ط¯ظ…طھ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
        if (query.specialistId) {
            const [specialist] = await this.dataSource.query(`SELECT id FROM specialists WHERE id = $1 AND tenant_id = $2 AND is_active = true`, [query.specialistId, id]);
            if (!specialist)
                throw new common_1.NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
        }
        const window = (0, working_hours_util_1.dayWindow)(tenant.working_hours, (0, working_hours_util_1.dayKeyForCivilDate)(date));
        const durationMinutes = service.duration_minutes;
        const starts = window ? (0, working_hours_util_1.slotStarts)(window, durationMinutes, working_hours_util_1.DEFAULT_SLOT_STEP_MINUTES) : [];
        if (starts.length === 0)
            return { data: [] };
        const rows = await this.withTenant(id, (manager) => manager.query(`WITH candidate AS (
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
                ) AS busy
         FROM candidate c
         ORDER BY c.start_minute`, [query.date, durationMinutes, starts, query.specialistId ?? null]));
        return {
            data: rows.map((row) => ({
                start: (0, working_hours_util_1.formatClock)(row.start_minute),
                end: (0, working_hours_util_1.formatClock)(row.start_minute + durationMinutes),
                available: !row.busy,
            })),
        };
    }
    withTenant(tenantId, work) {
        return this.dataSource.transaction(async (manager) => {
            await manager.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
            return work(manager);
        });
    }
    withPanelTenant(tenantId, work) {
        return this.dataSource.transaction(async (manager) => {
            await manager.query(`SELECT set_config('app.tenant_id', $1, true), set_config('app.current_tenant_id', $1, true)`, [tenantId]);
            return work(manager);
        });
    }
    async loadTags(salonIds) {
        const grouped = new Map();
        const ids = salonIds.filter((id) => typeof id === 'string' && id.length > 0);
        if (ids.length === 0)
            return grouped;
        const rows = await this.dataSource.query(`SELECT salon_id, tag FROM get_public_salon_tags($1::uuid[], $2::int)`, [ids, TAG_LIMIT]);
        for (const row of rows) {
            const list = grouped.get(row.salon_id);
            if (list)
                list.push(row.tag);
            else
                grouped.set(row.salon_id, [row.tag]);
        }
        return grouped;
    }
    async staffTenant(user) {
        const tenantId = this.requireStaffTenant(user);
        const rows = await this.withTenant(tenantId, async (manager) => {
            return manager.query(`SELECT t.id,
                t.name,
                t.slug,
                t.address,
                t.phone,
                t.cover_image_url,
                t.is_active,
                t.rating,
                t.review_count,
                t.working_hours,
                (SELECT COUNT(*)::int FROM specialists s WHERE s.tenant_id = t.id AND s.is_active = true) AS specialists_count,
                (SELECT COUNT(*)::int FROM services sv WHERE sv.tenant_id = t.id AND sv.is_active = true) AS services_count
         FROM tenants t
         WHERE t.id = $1`, [tenantId]);
        });
        const row = rows[0];
        if (!row)
            throw new common_1.NotFoundException('ط¨ظ‡ ط³ط§ظ„ظ†غŒ ظ…طھطµظ„ ظ†غŒط³طھغŒط¯');
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
        };
    }
    async staffApprovalStatus(user) {
        const tenantId = this.requireStaffTenant(user);
        const rows = await this.withTenant(tenantId, (manager) => manager.query(`SELECT t.status, t.rejection_reason, t.pending_changes
           FROM tenants t
          WHERE t.id = $1`, [tenantId]));
        const row = rows[0];
        if (!row)
            throw new common_1.NotFoundException('ط¨ظ‡ ط³ط§ظ„ظ†غŒ ظ…طھطµظ„ ظ†غŒط³طھغŒط¯');
        return {
            status: row.status,
            rejectionReason: row.rejection_reason,
            hasPendingChanges: row.pending_changes !== null && Object.keys(row.pending_changes).length > 0,
        };
    }
    async updateStaffProfile(user, dto) {
        const tenantId = this.requireStaffTenant(user);
        const changes = {};
        if (dto.name)
            changes.name = dto.name;
        if (dto.address)
            changes.address = dto.address;
        if (dto.phone)
            changes.phone = dto.phone;
        if (dto.coverImage)
            changes.coverImage = dto.coverImage;
        if (dto.workingHours)
            changes.workingHours = dto.workingHours;
        if (Object.keys(changes).length === 0) {
            throw new common_1.BadRequestException('ظپغŒظ„ط¯ ظ‚ط§ط¨ظ„ ظˆغŒط±ط§غŒط´غŒ ط§ط±ط³ط§ظ„ ظ†ط´ط¯ظ‡ ط§ط³طھ');
        }
        return this.stagePendingChanges(tenantId, changes);
    }
    async updateStaffSchedule(user, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.stagePendingChanges(tenantId, { workingHours: dto.workingHours });
    }
    async stagePendingChanges(tenantId, changes) {
        await this.dataSource.query(`UPDATE tenants
          SET pending_changes = COALESCE(pending_changes, '{}'::jsonb) || $2::jsonb,
              status = 'pending_approval',
              rejection_reason = NULL
        WHERE id = $1`, [tenantId, JSON.stringify(changes)]);
        return { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE };
    }
    async staffDashboard(user) {
        const tenantId = this.requireStaffTenant(user);
        const now = new Date();
        const todayStart = (0, jalali_date_util_1.startOfTehranDay)(now);
        const todayEnd = new Date(todayStart.getTime() + DAY_MS);
        const weekStart = (0, jalali_date_util_1.startOfTehranWeek)(now);
        const weekEnd = (0, jalali_date_util_1.endOfTehranWeek)(now);
        return this.withTenant(tenantId, async (manager) => {
            const specialistId = user.role === 'specialist'
                ? await this.activeSpecialistId(manager, user.userId)
                : null;
            if (user.role === 'specialist' && !specialistId) {
                throw new common_1.NotFoundException('ط§ط·ظ„ط§ط¹ط§طھ ظ…طھط®طµطµ ط´ظ…ط§ ط¯ط± ط³ط§ظ„ظ† غŒط§ظپطھ ظ†ط´ط¯');
            }
            const [today, week, pendingRow] = await Promise.all([
                this.dashboardAggregate(manager, todayStart, todayEnd, specialistId),
                this.dashboardAggregate(manager, weekStart, weekEnd, specialistId),
                manager.query(`SELECT COUNT(*)::int AS pending
           FROM bookings b
           WHERE b.status = 'pending'${specialistId ? ' AND b.specialist_id = $1' : ''}`, specialistId ? [specialistId] : []),
            ]);
            const [daily] = await Promise.all([
                manager.query(`SELECT (EXTRACT(DOW FROM (lower(b.time_slot) AT TIME ZONE 'Asia/Tehran'))::int + 1) % 7 AS day_index,
                  COALESCE(SUM(b.total_price::numeric) FILTER (WHERE ${REVENUE_STATUSES}), 0)::numeric AS amount
           FROM bookings b
           WHERE b.time_slot && tstzrange($1::timestamptz, $2::timestamptz, '[)')
             AND ${ACTIVE_BOOKING_STATUSES}${specialistId ? ' AND b.specialist_id = $3' : ''}
           GROUP BY 1
           ORDER BY 1`, withSpecialistId([weekStart.toISOString(), weekEnd.toISOString()], specialistId)),
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
    async dashboardAggregate(manager, start, end, specialistId) {
        const rows = await manager.query(`SELECT COUNT(*)::int AS bookings,
              COALESCE(SUM(b.total_price::numeric) FILTER (WHERE ${REVENUE_STATUSES}), 0)::numeric AS revenue
       FROM bookings b
       WHERE b.time_slot && tstzrange($1::timestamptz, $2::timestamptz, '[)')
         AND ${ACTIVE_BOOKING_STATUSES}${specialistId ? ' AND b.specialist_id = $3' : ''}`, withSpecialistId([start.toISOString(), end.toISOString()], specialistId));
        return rows[0] ?? { bookings: 0, revenue: '0' };
    }
    async dashboardTopSpecialists(manager, start, end, specialistId) {
        const rows = await manager.query(`SELECT s.id,
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
       LIMIT 5`, withSpecialistId([start.toISOString(), end.toISOString()], specialistId));
        return rows.map((row) => ({
            id: row.id,
            fullName: row.full_name,
            bookings: row.bookings,
            revenue: toNumber(row.revenue) ?? 0,
        }));
    }
    async activeSpecialistId(manager, userId) {
        const rows = await manager.query(`SELECT id FROM specialists WHERE user_id = $1 AND is_active = true`, [userId]);
        return rows[0]?.id ?? null;
    }
    async listServiceLines(user) {
        const tenantId = this.requireStaffTenant(user);
        const rows = await this.withTenant(tenantId, (manager) => manager.query(`SELECT sl.id,
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
          ORDER BY sl.created_at ASC, sl.id ASC`, [tenantId]));
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
    async createServiceLine(user, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.withTenant(tenantId, async (manager) => {
            const duplicate = await manager.query(`SELECT id FROM service_lines WHERE tenant_id = $1 AND name = $2`, [tenantId, dto.name]);
            if (duplicate.length > 0) {
                throw new common_1.BadRequestException('ط®ط·غŒ ط¨ط§ ط§غŒظ† ظ†ط§ظ… ظ‚ط¨ظ„ط§ظ‹ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
            }
            await manager.query(`INSERT INTO service_lines (tenant_id, name, description, status, is_active)
         VALUES ($1, $2, $3, 'pending_approval', true)`, [tenantId, dto.name, dto.description ?? null]);
            return { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE };
        });
    }
    async updateServiceLine(user, id, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.withTenant(tenantId, async (manager) => {
            const rows = await manager.query(`SELECT id, name, status FROM service_lines WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            const line = rows[0];
            if (!line)
                throw new common_1.NotFoundException('ط®ط· ط®ط¯ظ…ط§طھغŒ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            const nameChanges = dto.name !== undefined && dto.name !== line.name;
            if (nameChanges) {
                const duplicate = await manager.query(`SELECT id FROM service_lines WHERE tenant_id = $1 AND name = $2 AND id <> $3`, [tenantId, dto.name, id]);
                if (duplicate.length > 0) {
                    throw new common_1.BadRequestException('ط®ط·غŒ ط¨ط§ ط§غŒظ† ظ†ط§ظ… ظ‚ط¨ظ„ط§ظ‹ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
                }
            }
            const sets = [];
            const params = [tenantId, id];
            const push = (value) => {
                params.push(value);
                return `$${params.length}`;
            };
            if (dto.name !== undefined)
                sets.push(`name = ${push(dto.name)}`);
            if (dto.description !== undefined)
                sets.push(`description = ${push(dto.description)}`);
            if (dto.isActive !== undefined)
                sets.push(`is_active = ${push(dto.isActive)}`);
            if (nameChanges) {
                sets.push(`status = 'pending_approval', approved_at = NULL, rejection_reason = NULL`);
            }
            await manager.query(`UPDATE service_lines SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, params);
            return nameChanges
                ? { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE }
                : { status: line.status, message: 'ط«ط¨طھ ط´ط¯' };
        });
    }
    async deleteServiceLine(user, id) {
        const tenantId = this.requireStaffTenant(user);
        return this.withTenant(tenantId, async (manager) => {
            const rows = await manager.query(`SELECT id FROM service_lines WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            if (rows.length === 0)
                throw new common_1.NotFoundException('ط®ط· ط®ط¯ظ…ط§طھغŒ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            const bookings = await manager.query(`SELECT COUNT(*)::int AS count
           FROM bookings b
           JOIN services s ON s.id = b.service_id
          WHERE s.line_id = $1 AND ${ACTIVE_BOOKING_STATUSES}`, [id]);
            if ((bookings[0]?.count ?? 0) > 0) {
                throw new common_1.BadRequestException('ط§غŒظ† ط®ط· ط¯ط§ط±ط§غŒ ط±ط²ط±ظˆ ظپط¹ط§ظ„ ط§ط³طھ ظˆ ظپط¹ظ„ط§ظ‹ ظ‚ط§ط¨ظ„ ط­ط°ظپ ظ†غŒط³طھ');
            }
            await manager.query(`UPDATE service_lines SET is_active = false WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
        });
    }
    async listServices(user, lineId) {
        const tenantId = this.requireStaffTenant(user);
        const rows = await this.withTenant(tenantId, (manager) => manager.query(`SELECT s.id,
                s.line_id,
                s.name,
                s.description,
                s.price,
                s.duration_minutes,
                s.deposit_required,
                s.deposit_amount,
                s.is_active,
                s.created_at
           FROM services s
          WHERE s.tenant_id = $1 AND s.line_id = $2
          ORDER BY s.created_at ASC, s.id ASC`, [tenantId, lineId]));
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
            createdAt: row.created_at.toISOString(),
        }));
    }
    async createService(user, lineId, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.withTenant(tenantId, async (manager) => {
            const lines = await manager.query(`SELECT id FROM service_lines WHERE tenant_id = $1 AND id = $2`, [tenantId, lineId]);
            if (lines.length === 0)
                throw new common_1.NotFoundException('ط®ط· ط®ط¯ظ…ط§طھغŒ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            await manager.query(`INSERT INTO services
           (tenant_id, line_id, name, description, duration_minutes, price,
            deposit_required, deposit_amount, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`, [
                tenantId,
                lineId,
                dto.name,
                dto.description ?? null,
                dto.durationMinutes ?? 60,
                dto.price,
                dto.depositRequired ?? false,
                dto.depositRequired ? dto.depositAmount ?? null : null,
            ]);
            return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
        });
    }
    async updateService(user, id, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.withTenant(tenantId, async (manager) => {
            const rows = await manager.query(`SELECT id FROM services WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            if (rows.length === 0)
                throw new common_1.NotFoundException('ط®ط¯ظ…طھ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            const sets = [];
            const params = [tenantId, id];
            const push = (value) => {
                params.push(value);
                return `$${params.length}`;
            };
            if (dto.name !== undefined)
                sets.push(`name = ${push(dto.name)}`);
            if (dto.description !== undefined)
                sets.push(`description = ${push(dto.description)}`);
            if (dto.price !== undefined)
                sets.push(`price = ${push(dto.price)}`);
            if (dto.durationMinutes !== undefined)
                sets.push(`duration_minutes = ${push(dto.durationMinutes)}`);
            if (dto.depositRequired !== undefined) {
                sets.push(`deposit_required = ${push(dto.depositRequired)}`);
                if (dto.depositRequired === false)
                    sets.push(`deposit_amount = NULL`);
                else if (dto.depositAmount !== undefined)
                    sets.push(`deposit_amount = ${push(dto.depositAmount)}`);
            }
            else if (dto.depositAmount !== undefined) {
                sets.push(`deposit_amount = ${push(dto.depositAmount)}`);
            }
            if (dto.isActive !== undefined)
                sets.push(`is_active = ${push(dto.isActive)}`);
            if (sets.length > 0) {
                await manager.query(`UPDATE services SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`, params);
            }
            return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
        });
    }
    async deleteService(user, id) {
        const tenantId = this.requireStaffTenant(user);
        return this.withTenant(tenantId, async (manager) => {
            const rows = await manager.query(`SELECT id FROM services WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            if (rows.length === 0)
                throw new common_1.NotFoundException('ط®ط¯ظ…طھ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            await manager.query(`UPDATE services SET is_active = false WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
        });
    }
    async listPanelSpecialists(user) {
        const tenantId = this.requireStaffTenant(user);
        const rows = await this.withPanelTenant(tenantId, (manager) => manager.query(`SELECT sp.id,
                sp.user_id,
                u.full_name,
                u.phone,
                u.avatar_url,
                sp.bio,
                sp.skills,
                sp.commission_rate,
                sp.is_active,
                (SELECT COUNT(*)::int FROM bookings b WHERE b.specialist_id = sp.id) AS bookings_count
           FROM specialists sp
           LEFT JOIN users u ON u.id = sp.user_id
          WHERE sp.tenant_id = $1
          ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC`, [tenantId]));
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
            bookingsCount: row.bookings_count,
        }));
    }
    async listPanelBookings(user, query) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const scope = await this.resolveBookingScope(manager, user, tenantId);
            const { startIso, endIso } = this.bookingWindow(query);
            const countFilters = this.bookingFilters(scope, undefined, startIso, endIso, 0);
            const countRows = await manager.query(`SELECT b.status, COUNT(*)::int AS total
           FROM bookings b
           LEFT JOIN services sv ON sv.id = b.service_id
          WHERE ${countFilters.where}
          GROUP BY b.status`, countFilters.whereParams);
            const filters = this.bookingFilters(scope, query, startIso, endIso, 1);
            const limitPlaceholder = 1 + filters.whereParams.length + filters.statusParams.length + 1;
            const offsetPlaceholder = limitPlaceholder + 1;
            const rows = await manager.query(`WITH scoped AS (
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
                  b.service_id
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
                sv.line_id
           FROM scoped sc
           LEFT JOIN contacts ON contacts.customer_id = sc.customer_id
           LEFT JOIN specialists sp ON sp.id = sc.specialist_id
           LEFT JOIN users u ON u.id = sp.user_id
           LEFT JOIN services sv ON sv.id = sc.service_id
          WHERE ${filters.statusWhere}
          ORDER BY sc.starts_at DESC, sc.id DESC
          LIMIT $${limitPlaceholder} OFFSET $${offsetPlaceholder}`, [
                tenantId,
                ...filters.whereParams,
                ...filters.statusParams,
                query.limit,
                (query.page - 1) * query.limit,
            ]);
            const counts = this.zeroBookingCounts();
            let total = 0;
            for (const row of countRows) {
                const value = toNumber(row.total) ?? 0;
                total += value;
                switch (row.status) {
                    case salon_bookings_query_dto_1.SalonBookingStatus.Pending:
                        counts.pending = value;
                        break;
                    case salon_bookings_query_dto_1.SalonBookingStatus.Confirmed:
                        counts.confirmed = value;
                        break;
                    case salon_bookings_query_dto_1.SalonBookingStatus.Completed:
                        counts.completed = value;
                        break;
                    case salon_bookings_query_dto_1.SalonBookingStatus.Reviewed:
                        counts.reviewed = value;
                        break;
                    case salon_bookings_query_dto_1.SalonBookingStatus.Cancelled:
                        counts.cancelled = value;
                        break;
                    case salon_bookings_query_dto_1.SalonBookingStatus.NoShow:
                        counts.noShow = value;
                        break;
                }
            }
            const effectiveTotal = query.status === undefined
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
    async getPanelBooking(user, id) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const scope = await this.resolveBookingScope(manager, user, tenantId);
            const row = await this.findScopedPanelBooking(manager, tenantId, id, scope);
            return this.toPanelBookingDetail(manager, tenantId, row);
        });
    }
    async approvePanelBooking(user, id) {
        const tenantId = this.requireStaffTenant(user);
        const result = await this.transitionPanelBooking(user, id, salon_bookings_query_dto_1.SalonBookingStatus.Pending, 'این رزرو قبلاً بررسی شده است', async (manager) => {
            const updated = await manager.query(`UPDATE bookings
              SET status = 'confirmed',
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'pending'`, [id, tenantId]);
            if (affectedRows(updated) !== 1) {
                throw new common_1.ConflictException('این رزرو قبلاً بررسی شده است');
            }
        });
        const event = {
            bookingId: result.id,
            tenantId,
            customerId: result.customerId,
            specialistId: result.specialistId,
            serviceId: result.serviceId ?? '',
        };
        this.events.emit(domain_events_1.BOOKING_CONFIRMED, event);
        return result;
    }
    async rejectPanelBooking(user, id, dto) {
        const tenantId = this.requireStaffTenant(user);
        const reason = dto.reason.trim();
        const result = await this.transitionPanelBooking(user, id, salon_bookings_query_dto_1.SalonBookingStatus.Pending, 'این رزرو قبلاً بررسی شده است', async (manager) => {
            const updated = await manager.query(`UPDATE bookings
              SET status = 'cancelled',
                  notes = CASE
                            WHEN notes IS NULL OR notes = '' THEN $3
                            ELSE notes || E'\n— ' || $3
                          END,
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'pending'`, [id, tenantId, reason]);
            if (affectedRows(updated) !== 1) {
                throw new common_1.ConflictException('این رزرو قبلاً بررسی شده است');
            }
        });
        const event = {
            bookingId: result.id,
            tenantId,
            customerId: result.customerId,
            reason: 'specialist_unavailable',
            refundAmount: 0,
        };
        this.events.emit(domain_events_1.BOOKING_CANCELLED, event);
        return result;
    }
    async markVisitedPanelBooking(user, id) {
        const tenantId = this.requireStaffTenant(user);
        return this.transitionPanelBooking(user, id, salon_bookings_query_dto_1.SalonBookingStatus.Confirmed, 'این رزرو قبلاً بررسی شده است', async (manager) => {
            const updated = await manager.query(`UPDATE bookings
              SET status = 'completed',
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'confirmed'`, [id, tenantId]);
            if (affectedRows(updated) !== 1) {
                throw new common_1.ConflictException('این رزرو قبلاً بررسی شده است');
            }
        });
    }
    async noShowPanelBooking(user, id) {
        const tenantId = this.requireStaffTenant(user);
        return this.transitionPanelBooking(user, id, salon_bookings_query_dto_1.SalonBookingStatus.Confirmed, 'این رزرو قبلاً بررسی شده است', async (manager) => {
            const updated = await manager.query(`UPDATE bookings
              SET status = 'no_show',
                  updated_at = NOW()
            WHERE id = $1
              AND tenant_id = $2
              AND status = 'confirmed'
              AND lower(time_slot) <= NOW()`, [id, tenantId]);
            if (affectedRows(updated) !== 1) {
                throw new common_1.ConflictException('این رزرو قبلاً بررسی شده است');
            }
        });
    }
    async transitionPanelBooking(user, id, from, conflictMessage, update) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const scope = await this.resolveBookingScope(manager, user, tenantId);
            const current = await this.findScopedPanelBooking(manager, tenantId, id, scope);
            if (current.status !== from) {
                throw new common_1.ConflictException(conflictMessage);
            }
            await update(manager);
            const row = await this.findScopedPanelBooking(manager, tenantId, id, scope);
            return this.toPanelBookingDetail(manager, tenantId, row);
        });
    }
    async loadTenantPanelContext(manager, tenantId) {
        const rows = await manager.query(`SELECT working_hours, settings FROM tenants WHERE id = $1`, [tenantId]);
        if (rows.length === 0)
            throw new common_1.NotFoundException('سالن یافت نشد');
        return rows[0];
    }
    async toPanelBookingDetail(manager, tenantId, row) {
        const tenant = await this.loadTenantPanelContext(manager, tenantId);
        return {
            ...this.toPanelBookingItem(row),
            workingHours: (tenant.working_hours ?? {}),
            settings: (tenant.settings ?? {}),
        };
    }
    async findScopedPanelBooking(manager, tenantId, id, scope) {
        const filters = this.bookingFilters(scope, undefined, undefined, undefined, 2);
        const rows = await manager.query(`SELECT b.id,
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
          AND ${filters.where}`, [tenantId, id, ...filters.whereParams]);
        if (rows.length === 0) {
            throw new common_1.NotFoundException('رزرو یافت نشد');
        }
        return rows[0];
    }
    async resolveBookingScope(manager, user, tenantId) {
        if (user.role === 'salon_owner' || user.role === 'admin') {
            return { fragment: 'TRUE', params: [] };
        }
        if (user.role === 'line_manager') {
            const rows = await manager.query(`SELECT sl.line_id AS id
           FROM service_lines sl
          WHERE sl.tenant_id = $1
            AND sl.manager_id = $2
            AND sl.is_active = TRUE`, [tenantId, user.userId]);
            if (rows.length === 0)
                return { fragment: 'FALSE', params: [] };
            return {
                fragment: 'sv.line_id = ANY($1::uuid[])',
                params: [rows.map((row) => row.id)],
            };
        }
        if (user.role === 'specialist') {
            const rows = await manager.query(`SELECT id FROM specialists WHERE tenant_id = $1 AND user_id = $2`, [tenantId, user.userId]);
            if (rows.length === 0)
                return { fragment: 'FALSE', params: [] };
            return {
                fragment: 'b.specialist_id = $1',
                params: [rows[0].id],
            };
        }
        return { fragment: 'FALSE', params: [] };
    }
    bookingFilters(scope, query, startIso, endIso, offset) {
        const parts = [
            scope.fragment.replace(/\$(\d+)/g, (_match, digits) => `$${Number(digits) + offset}`),
        ];
        const scopeParams = [...scope.params];
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
        let statusWhere = 'TRUE';
        const statusParams = [];
        if (query?.status !== undefined) {
            statusParams.push(query.status);
            statusWhere = `sc.status = $${offset + scopeParams.length + statusParams.length}`;
        }
        return { where, statusWhere, whereParams: scopeParams, statusParams };
    }
    bookingWindow(query) {
        const DAY_MS = 24 * 60 * 60 * 1000;
        const dayStart = (value) => value === undefined ? undefined : (0, jalali_date_util_1.startOfTehranDay)(new Date(`${value}T00:00:00Z`));
        if (query.date !== undefined) {
            const start = dayStart(query.date);
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
    zeroBookingCounts() {
        return {
            pending: 0,
            confirmed: 0,
            completed: 0,
            reviewed: 0,
            cancelled: 0,
            noShow: 0,
        };
    }
    toPanelBookingItem(row) {
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
        };
    }
    async createPanelSpecialist(user, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const users = await manager.query(`SELECT id, role FROM users WHERE phone = $1`, [dto.phone]);
            let userId;
            const existing = users[0];
            if (existing) {
                if (existing.role !== 'specialist') {
                    throw new common_1.BadRequestException('ط§غŒظ† ط´ظ…ط§ط±ظ‡ ط¨ط§ ظ†ظ‚ط´ ط¯غŒع¯ط±غŒ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
                }
                const owned = await manager.query(`SELECT id FROM specialists WHERE tenant_id = $1 AND user_id = $2`, [tenantId, existing.id]);
                if (owned.length > 0) {
                    throw new common_1.BadRequestException('ط§غŒظ† ع©ط§ط±ط¨ط± ظ‚ط¨ظ„ط§ظ‹ ط¨ظ‡ ط¹ظ†ظˆط§ظ† ظ…طھط®طµطµ ط¯ط± ط§غŒظ† ط³ط§ظ„ظ† ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
                }
                userId = existing.id;
                await manager.query(`UPDATE users SET full_name = $2 WHERE id = $1`, [
                    existing.id,
                    dto.fullName,
                ]);
            }
            else {
                try {
                    const inserted = await manager.query(`INSERT INTO users (tenant_id, phone, full_name, role, is_active)
             VALUES ($1, $2, $3, 'specialist', true)
             RETURNING id`, [tenantId, dto.phone, dto.fullName]);
                    userId = inserted[0].id;
                }
                catch (error) {
                    if (error.code === '23505') {
                        throw new common_1.BadRequestException('ط§غŒظ† ط´ظ…ط§ط±ظ‡ ظ‚ط¨ظ„ط§ظ‹ ط¨ط§ ظ†ظ‚ط´ ط¯غŒع¯ط±غŒ ط«ط¨طھ ط´ط¯ظ‡ ط§ط³طھ');
                    }
                    throw error;
                }
            }
            const inserted = await manager.query(`INSERT INTO specialists (tenant_id, user_id, bio, skills, commission_rate, is_active, status)
         VALUES ($1, $2, $3, $4::jsonb, $5, true, 'approved')
         RETURNING id`, [
                tenantId,
                userId,
                dto.bio ?? null,
                JSON.stringify(dto.skills ?? []),
                dto.commissionRate ?? 50,
            ]);
            return {
                id: inserted[0].id,
                fullName: dto.fullName,
                phone: dto.phone,
                status: 'approved',
            };
        });
    }
    async updatePanelSpecialist(user, id, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const rows = await manager.query(`SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            if (rows.length === 0)
                throw new common_1.NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            const sets = [];
            const params = [tenantId, id];
            const push = (value) => {
                params.push(value);
                return `$${params.length}`;
            };
            if (dto.bio !== undefined)
                sets.push(`bio = ${push(dto.bio)}`);
            if (dto.skills !== undefined)
                sets.push(`skills = ${push(JSON.stringify(dto.skills))}::jsonb`);
            if (dto.commissionRate !== undefined) {
                sets.push(`commission_rate = ${push(dto.commissionRate)}`);
            }
            if (dto.isActive !== undefined)
                sets.push(`is_active = ${push(dto.isActive)}`);
            if (sets.length > 0) {
                await manager.query(`UPDATE specialists SET ${sets.join(', ')}, status = 'approved' WHERE tenant_id = $1 AND id = $2`, params);
            }
            return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
        });
    }
    async deletePanelSpecialist(user, id) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const rows = await manager.query(`SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            if (rows.length === 0)
                throw new common_1.NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            const bookings = await manager.query(`SELECT COUNT(*)::int AS count
           FROM bookings b
          WHERE b.specialist_id = $1 AND ${ACTIVE_BOOKING_STATUSES}`, [id]);
            if ((bookings[0]?.count ?? 0) > 0) {
                throw new common_1.BadRequestException('ط§غŒظ† ظ…طھط®طµطµ ط±ط²ط±ظˆ ظپط¹ط§ظ„ ط¯ط§ط±ط¯');
            }
            await manager.query(`UPDATE specialists SET is_active = false WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
            return { status: 'approved', message: 'ط«ط¨طھ ط´ط¯' };
        });
    }
    async listPanelPortfolio(user) {
        const tenantId = this.requireStaffTenant(user);
        const rows = await this.withPanelTenant(tenantId, (manager) => manager.query(`SELECT CASE
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
          ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC, img.ord ASC`, [tenantId]));
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
    async addPanelPortfolioItem(user, dto) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const specs = await manager.query(`SELECT id FROM specialists WHERE tenant_id = $1 AND id = $2`, [tenantId, dto.specialistId]);
            if (specs.length === 0)
                throw new common_1.NotFoundException('ظ…طھط®طµطµ ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            const element = JSON.stringify({
                id: (0, node_crypto_1.randomUUID)(),
                url: dto.imageUrl,
                createdAt: new Date().toISOString(),
            });
            await manager.query(`UPDATE specialists
            SET portfolio_images = COALESCE(portfolio_images, '[]'::jsonb)
                || jsonb_build_array($3::jsonb)
          WHERE tenant_id = $1 AND id = $2`, [tenantId, dto.specialistId, element]);
            return this.stagePortfolioReview(manager, tenantId);
        });
    }
    async deletePanelPortfolioItem(user, id) {
        const tenantId = this.requireStaffTenant(user);
        return this.withPanelTenant(tenantId, async (manager) => {
            const specs = await manager.query(`SELECT id, portfolio_images FROM specialists WHERE tenant_id = $1`, [tenantId]);
            const target = id.toLowerCase().replaceAll('-', '');
            let removed = false;
            for (const spec of specs) {
                const images = Array.isArray(spec.portfolio_images) ? spec.portfolio_images : [];
                const index = images.findIndex((element, position) => portfolioElementId(spec.id, position, element).toLowerCase().replaceAll('-', '') ===
                    target);
                if (index === -1)
                    continue;
                images.splice(index, 1);
                await manager.query(`UPDATE specialists SET portfolio_images = $3::jsonb WHERE tenant_id = $1 AND id = $2`, [tenantId, spec.id, JSON.stringify(images)]);
                removed = true;
                break;
            }
            if (!removed)
                throw new common_1.NotFoundException('ظ†ظ…ظˆظ†ظ‡â€Œع©ط§ط± ظ…ظˆط±ط¯ ظ†ط¸ط± غŒط§ظپطھ ظ†ط´ط¯');
            return this.stagePortfolioReview(manager, tenantId);
        });
    }
    async stagePortfolioReview(manager, tenantId) {
        await manager.query(`UPDATE tenants
          SET status = 'pending_approval',
              rejection_reason = NULL
        WHERE id = $1`, [tenantId]);
        return { status: 'pending_approval', message: PENDING_APPROVAL_MESSAGE };
    }
    requireStaffTenant(user) {
        if (!user || !STAFF_ROLES.has(user.role)) {
            throw new common_1.ForbiddenException('ط§غŒظ† ط¨ط®ط´ ظپظ‚ط· ط¨ط±ط§غŒ ظ¾ط±ط³ظ†ظ„ ط³ط§ظ„ظ† ط§ط³طھ');
        }
        if (!user.tenantId)
            throw new common_1.NotFoundException('ط¨ظ‡ ط³ط§ظ„ظ†غŒ ظ…طھطµظ„ ظ†غŒط³طھغŒط¯');
        return user.tenantId;
    }
    async loadSpecialists(salonId) {
        const rows = await this.dataSource.query(`SELECT id, full_name, avatar_url, bio, skills, commission_rate
       FROM get_public_salon_specialists($1::uuid)`, [salonId]);
        return rows.map((row) => ({
            id: row.id,
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            bio: row.bio,
            skills: row.skills ?? [],
            commissionRate: toNumber(row.commission_rate) ?? 0,
        }));
    }
    toListItem(row, tags, now) {
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
};
exports.SalonService = SalonService;
exports.SalonService = SalonService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        event_emitter_1.EventEmitter2])
], SalonService);
const DEFAULT_WEIGHTS = { distance: 0.3, price: 0.3, rating: 0.3, discount: 0.1 };
function normaliseWeights(input) {
    const raw = {
        distance: positive(input?.distance) ?? DEFAULT_WEIGHTS.distance,
        price: positive(input?.price) ?? DEFAULT_WEIGHTS.price,
        rating: positive(input?.rating) ?? DEFAULT_WEIGHTS.rating,
        discount: positive(input?.discount) ?? DEFAULT_WEIGHTS.discount,
    };
    const total = raw.distance + raw.price + raw.rating + raw.discount;
    if (total <= 0)
        return DEFAULT_WEIGHTS;
    return {
        distance: raw.distance / total,
        price: raw.price / total,
        rating: raw.rating / total,
        discount: raw.discount / total,
    };
}
function positive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
function sortByWeightedScore(items, weights) {
    if (items.length === 0)
        return items;
    const distances = items.map((item) => item.distanceKm).filter(isFiniteNumber);
    const prices = items.map((item) => item.minPrice).filter(isFiniteNumber);
    const ratings = items.map((item) => item.rating).filter(isFiniteNumber);
    const discounts = items.map((item) => item.discountPercent ?? 0);
    const distanceScale = invertedScale(distances);
    const priceScale = invertedScale(prices);
    const ratingScale = ascendingScale(ratings);
    const discountScale = ascendingScale(discounts);
    const score = (item) => weights.distance * distanceScale(item.distanceKm) +
        weights.price * priceScale(item.minPrice) +
        weights.rating * ratingScale(item.rating) +
        weights.discount * discountScale(item.discountPercent ?? 0);
    return items
        .map((item, index) => ({ item, index, score: score(item) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map((entry) => entry.item);
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function invertedScale(values) {
    const [min, max] = bounds(values);
    if (min === null || max === null)
        return () => 0;
    if (max === min)
        return () => 1;
    return (value) => (isFiniteNumber(value) ? 1 - (value - min) / (max - min) : 0);
}
function ascendingScale(values) {
    const [min, max] = bounds(values);
    if (min === null || max === null)
        return () => 0;
    if (max === min)
        return () => 1;
    return (value) => (isFiniteNumber(value) ? (value - min) / (max - min) : 0);
}
function bounds(values) {
    if (values.length === 0)
        return [null, null];
    return [Math.min(...values), Math.max(...values)];
}
function isSalonOpenNow(workingHours, now = new Date()) {
    const day = (0, working_hours_util_1.dayWindow)(workingHours, (0, working_hours_util_1.dayKeyForInstant)(now));
    return day !== null && (0, working_hours_util_1.withinWindow)(day, (0, working_hours_util_1.minutesSinceMidnight)(now));
}
function parseCivilDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day) {
        throw new common_1.BadRequestException('طھط§ط±غŒط® ظˆط§ط±ط¯â€Œط´ط¯ظ‡ ظ…ط¹طھط¨ط± ظ†غŒط³طھ');
    }
    return { year, month, day };
}
const DAY_MS = 24 * 60 * 60 * 1000;
const STAFF_ROLES = new Set(['salon_owner', 'line_manager', 'specialist', 'admin']);
const ACTIVE_BOOKING_STATUSES = `b.status IN ('pending', 'confirmed', 'completed')`;
const UUID_ELEMENT_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function portfolioElementId(specialistId, position, element) {
    if (element !== null && typeof element === 'object') {
        const record = element;
        const ownId = record.id ?? record.imageId;
        if (typeof ownId === 'string' && UUID_ELEMENT_PATTERN.test(ownId))
            return ownId;
    }
    return (0, node_crypto_1.createHash)('md5').update(`${specialistId}:portfolio:${position}`).digest('hex');
}
const REVENUE_STATUSES = `b.status IN ('confirmed', 'completed')`;
function withSpecialistId(params, specialistId) {
    return specialistId ? [...params, specialistId] : params;
}
function buildWeeklyRevenue(rows) {
    const byDay = new Map();
    for (const row of rows) {
        byDay.set(row.day_index, toNumber(row.amount) ?? 0);
    }
    return Array.from({ length: 7 }, (_, dayIndex) => ({
        dayIndex,
        amount: byDay.get(dayIndex) ?? 0,
    }));
}
