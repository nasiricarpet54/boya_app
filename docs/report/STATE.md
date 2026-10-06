# STATE — گزارش وضعیت پروژه BOYA برای مشاور فنی
تاریخ: 2026-10-03 | بدون حدس — هرچه نیست «ندارد»
فاز: Phase 1 ویترین رایگان (طبق PROJECT_CHARTER.md) — پرداخت آنلاین خاموش

## Stack
- Node runtime اندازه‌گیری‌شده: v24.11.0 / npm 11.6.1 | engines در backend/package.json: >=20 | CI در .github/workflows/backend.yml: node 22
- NestJS: @nestjs/common 11.1.6 / @nestjs/core 11.1.6 / platform-express 11.1.6 / cli 11.0.10 / schematics 11.0.7 / testing 11.1.6
- ORM: typeorm 0.3.27 + @nestjs/typeorm 11.0.0 + pg 8.16.3 | synchronize: false | migrations: dist/database/migrations/*.js
- PostgreSQL: postgres:16-alpine (docker-compose.yml) | پورت هاست 5433→5432 (فایل) — README می‌گوید 5432 (متن با فایل ناسازگار است)
- Redis: redis:7-alpine، پورت هاست 6380→6379 | ioredis 5.8.2 | bull 4.16.5 + @nestjs/bull 12.0.0 | cache: @nestjs/cache-manager 3.1.0 + cache-manager 6.4.3 + @keyv/redis 5.1.6 + keyv 5.6.0
- Flutter: 3.47.5 stable | Dart: 3.13.4 | SDK در pubspecها: ^3.12.0، flutter >=3.44.0
- Backend deps اصلی (backend/package.json): @nestjs/config 4.0.2، @nestjs/jwt 11.0.1، @nestjs/passport 11.0.5 + passport 0.7.0 + passport-jwt 4.0.1، @nestjs/event-emitter 3.0.1، @nestjs/schedule 12.0.2، @nestjs/swagger 11.2.1، @nestjs/throttler 6.5.0، nestjs-cls 6.2.0، stripe 22.6.2 (نصب ولی در src استفاده ندارد — فقط stripeConfig)، @mirad-work/sms-nestjs 0.5.0 + @mirad-work/sms-core 0.5.1، firebase-admin 14.5.0، date-fns-jalali 4.4.0-0، helmet 8.1.0، compression 1.8.1، class-validator 0.14.2 + class-transformer 0.5.1، rxjs 7.8.2، reflect-metadata 0.2.2، @jeonghochoi/rbac 0.1.7 (نصب ولی import در src ندارد)
- Flutter deps: customer_app: flutter_riverpod ^3.4.3، go_router ^18.0.1 (نصب 18.0.2)، dio ^5.11.1، shared_preferences ^2.2.3، cached_network_image ^4.0.3، shimmer ^4.0.0 + boya_shared path | salon_app: +flutter_localizations +dio ^5.4.0 +shared_preferences ^2.5.5 +url_launcher ^6.3.1 | specialist_app: flutter_riverpod +go_router +boya_shared (dio ندارد) | shared (boya_shared 1.0.0): flutter_riverpod ^3.4.3، riverpod_annotation ^4.0.7، go_router ^18.0.1، dio ^5.11.1، retrofit ^4.10.0، json_annotation ^4.12.0، freezed_annotation ^3.1.0، flutter_secure_storage ^11.2.0، shared_preferences ^2.5.5، neshan_maps_flutter ^1.1.0، geolocator ^14.0.3، cached_network_image ^4.0.2، shimmer ^4.0.0، fl_chart ^1.2.0، parsi_datetime_picker ^0.0.2، text_fa ^1.0.0، intl ^0.20.3، firebase_core ^4.15.0، firebase_messaging ^16.7.0، flutter_local_notifications ^22.3.1، equatable ^2.0.8
- Admin-panel: Next.js 14.2.33 (از package-lock) — جزئیات کامل در این گزارش نیست

## Structure
```
E:\BOYA platform
├── .github/workflows/ (backend.yml)
├── admin-panel/src/app/[locale]/((protected)/approvals,audit-logs,dashboard,settings,tenants,transactions,users) + lib/api/
├── backend/src/
│   ├── app.module.ts + main.ts
│   ├── common/{approval-status,domain-events,persian-errors + decorators,filters,guards,interceptors,pipes(خالی/.gitkeep)}
│   ├── config/{env.validation.ts,services.config.ts,typeorm.config.ts}
│   ├── database/{data-source.ts,data-source.migration.ts,migrations/*.ts,seeds/}
│   ├── modules/{admin,auth,booking,common,health,notification,payment,referral,review,salon,service,service-line,specialist,tenant,user}
│   ├── sources/auth/ + types/ + utils/{jalali-date,working-hours,persian-number}
├── backend/test/ (9 فایل)
├── mobile/customer_app/lib/{core/network,features/{auth,booking,home,notifications,profile,salon,referral?},shared/widgets} + main.dart
├── mobile/salon_app/lib/{core/{router,navigation},features/{auth,bookings,dashboard,finance,portfolio,profile,salon,services,specialists}} + main.dart
├── mobile/specialist_app/lib/{app.dart,main.dart,features/{bookings,dashboard,profile,schedule}}
├── mobile/shared/lib/{api(.gitkeep),app/boya_app.dart,beauty_shared.dart,boya_shared.dart,localization/{fa,en}.json,models(.gitkeep),theme/{boya_colors,boya_theme,boya_typography},utils/{jalali,persian-number,text-direction},widgets/{boya_date_picker,boya_logo}}
├── web/{customer,salon,specialist} (stand-in تست، ساخته نشده)
├── design_system/boya_design_system.md
├── docker/postgres/init/01-roles.sql
├── docs/report/00-index.md
├── docker-compose.yml + README.md + PROJECT_CHARTER.md
```
- محتوای package.json ریشه: ندارد (فایل package.json در ریشه نیست؛ فقط package-lock.json با `{"name":"BOYA platform","lockfileVersion":3,"packages":{}}`)
- docker-compose.yml (کامل):
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: boya_postgres_dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: beauty
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: beauty_platform
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U beauty -d beauty_platform"]
      interval: 5s
      timeout: 5s
      retries: 10
  redis:
    image: redis:7-alpine
    container_name: boya_redis_dev
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6380:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  postgres_data:
  redis_data:
```
- docker/postgres/init/01-roles.sql (کامل): نقش beauty_app با NOBYPASSRLS/NOSUPERUSER + GRANT CONNECT/USAGE/SELECT,INSERT,UPDATE,DELETE + ALTER DEFAULT PRIVILEGES

## Database
- لیست migrationها به ترتیب (26 عدد + .gitkeep):
  1. 1730000000000-CreateBookings (tenants/users/specialists/services/bookings + Exclusion + RLS bookings)
  2. 1730000000001-PerformanceIndexes
  3. 1730000000002-TenantUserProfile (ستون‌های tenants/users + RLS users با app.current_tenant_id)
  4. 1730000000003-ServiceLines (service_lines + RLS با app.current_tenant_id)
  5. 1730000000004-Transactions (transactions + processed_webhook_events + RLS با app.current_tenant_id)
  6. 1730000000005-Notifications (notifications + RLS با app.current_tenant_id)
  7. 1730000000006-Referrals (referrals/loyalty_points — بدون RLS، user-scoped)
  8. 1730000000007-MakeUserTenantNullable (users.tenant_id NULL — مشتری چندسالنه)
  9. 1730000000008-CustomerLookupFunction (find_or_create_customer_by_phone، SECURITY DEFINER)
  10. 1730000000009-AddSalonFieldsAndCategories (فیلدهای سالن + categories + seed + get_public_salon_tags)
  11. 1730000000010-AddCategoryEmoji
  12. 1730000000011-AddBookingReviewedStatus (وضعیت reviewed + reminder cols + no_show_count + reviews + premium cols)
  13. 1730000000012-AlignServiceAndSpecialistSchema
  14. 1730000000013-LookupFunctionReturnsTenantId (خروجی tenant_id به lookup، GRANT به beauty_app)
  15. 1730000000014-CustomerBookingsLookup (get_customer_bookings، SECURITY DEFINER)
  16. 1730000000015-PublicSalonSpecialistsLookup
  17. 1730000000016-PublicSalonPortfolioLookup
  18. 1730000000017-SeedSpecialistPortfolioImages (dev-only mock CDN)
  19. 1730000000018-ApprovalSchema (enum approval_status + ستون‌های approval)
  20. 1730000000019-SeedExistingAsApproved
  21. 1730000000020-AdminApprovalAccess (توابع admin برای service_lines)
  22. 1730000000021-PanelBookingsLookup (lookup پنل bookings + نام مشتری)
  23. 1730000000022-AdminDashboard
  24. 1730000000023-AdminTenants
  25. 1730000000024-AdminUsers
  26. 1730000000025-DeviceTokens (device_tokens بدون RLS)
- migration RLS/Exclusion (کد کامل کلیدی):
```ts
// 1730000000000 — bookings: Exclusion + RLS (کامل)
await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
CREATE TABLE bookings (... time_slot TSTZRANGE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (specialist_id WITH =, time_slot WITH &&)
  WHERE (status NOT IN ('cancelled','no_show')));
CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_specialist_time ON bookings USING GIST (specialist_id, time_slot);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY; ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY bookings_tenant_isolation ON bookings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```
```ts
// 1730000000002 — users (کامل policy)
ALTER TABLE users ENABLE/FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```
```ts
// 1730000000003/0004/0005 — الگوی یکسان با app.current_tenant_id:
service_lines_tenant_isolation / transactions_tenant_isolation / notifications_tenant_isolation
USING/WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```
نکته: دو املای متفاوت GUC وجود دارد — bookings روی `app.tenant_id` و بقیه روی `app.current_tenant_id`؛ به همین دلیل salon.service دوتایی set می‌کند.
- entityهای اصلی (tenant_id + روابط — روابط TypeORM نیست، ستون FK خام است):
  bookings(tenantId,specialistId,customerId,serviceId,timeSlot,status,totalPrice) | users(tenantId,phone,role,noShowCount) | tenants(بدون tenant_id؛ name/slug/status) | specialists(tenantId,userId,commissionRate,status) | services(tenantId,lineId,durationMinutes,price) | service_lines(tenantId,managerId,status) | transactions(tenantId,bookingId UNIQUE,provider,status,totalAmount,platformFee,specialistShare,salonShare,refundAmount) | notifications(tenantId,userId,type) | reviews(tenantId,bookingId UNIQUE,customerId,specialistId,rating) | referrals/loyalty_points(بدون tenant_id) | device_tokens(بدون tenant_id؛ userId+token) | processed_webhook_events(eventId PK)
- TenantModule/CLS + محل SET (کد کامل مرتبط):
```ts
// backend/src/app.module.ts
ClsModule.forRoot({ global: true, middleware: { mount: true } });
// backend/src/modules/tenant/tenant.module.ts — فقط Tenant CRUD؛ هیچ Interceptor/GUARD/ClsService در آن نیست
@Module({ imports: [TypeOrmModule.forFeature([Tenant])], controllers: [TenantController], providers: [TenantService], exports: [TenantService] })
export class TenantModule {}
// هیچ TenantInterceptor/TenantMiddleware/ClsService در src وجود ندارد (جستجو: ندارد)
// SET فقط transaction-local با set_config(...,true):
// booking.service: SELECT set_config('app.tenant_id',$1,true) در create() و inTenant()
// salon.service withTenant: set_config('app.tenant_id')؛ withPanelTenant: set_config('app.tenant_id') + set_config('app.current_tenant_id')
// login/lookup: هیچ SET نیست — via SECURITY DEFINER find_or_create_customer_by_phone + get_customer_bookings
```

## Auth
```ts
// backend/src/modules/auth/auth.service.ts (کامل)
async verifyOtpAndIssueToken(phoneNumber, code) {
  await this.otpService.verifyOtp(phoneNumber, code);
  const normalized = this.normalizePhone(phoneNumber); // fa/ar→latin، +98/98→0
  const rows = await this.dataSource.query(
    `SELECT id, phone, full_name, role, is_new, tenant_id FROM find_or_create_customer_by_phone($1)`, [normalized]);
  const row = rows[0]; const tenantId = row.tenant_id ?? null;
  const token = await this.jwtService.signAsync({ sub: row.id, phone: row.phone, role: row.role, tenantId });
  return { token, user: { id, phoneNumber, fullName, role, isNewUser: row.is_new, tenantId } };
}
```
```ts
// backend/src/modules/auth/otp.service.ts (خلاصه کامل)
sendOtp: normalize → redis.incr(otp:rate) max3/600s → code randomInt(100000,1000000) → redis.set(otp, sha256(OTP_PEPPER:phone:code), EX120s) → اگر !KAVENEGAR_API_KEY یا NODE_ENV!=production: console.log DEV OTP و return؛ وگرنه smsService.verify({to, template:'boya-otp', tokens:{code}})
verifyOtp: get نبود→OTP_EXPIRED؛ incr(tries)>5→429؛ toLatinDigits مقایسه timingSafeEqual؛ del
// JwtAuthGuard (APP_GUARD): @Public via Reflector وگرنه Bearer + verify(JWT_ACCESS_SECRET) → request.user {userId,phoneNumber,role,tenantId}
// AuthController: POST /auth/otp/send + /auth/otp/verify (هر دو @Public)
// Kavenegar: SmsModule defaultDriver KAVENEGAR url api.kavenegar.com/v1/؛ OtpService قالب boya-otp؛ KavenegarAlertService قالب KAVENEGAR_BOOKING_TEMPLATE (اگر unset→warn+false)
// Guards دیگر: ThrottlerGuard سراسری 100/min؛ PaymentFeatureFlag فقط PaymentController؛ RolesGuard/RBAC: ندارد
```

## Booking
- create (کامل منطق backend/src/modules/booking/booking.service.ts:80-129): service/specialist findById → isActive و startsAt>now و assertWithinWorkingHours (working_hours {} → عبور) → transaction: set_config('app.tenant_id') + save Booking{timeSlot:`[start,end)`,pending,totalPrice} → emit BOOKING_CREATED؛ catch code 23P01 → Conflict فارسی
- زمان خالی دو لایه: (1) AvailabilityService unit: generateSlots(workingHours,date,duration,step30) + filterAvailable(end<=start||start>=end)؛ (2) SalonService.availableSlots (salon.service.ts:846-909): dayWindow + SQL candidate AT TIME ZONE 'Asia/Tehran' + EXISTS(time_slot && tstzrange AND status NOT IN cancelled/no_show) داخل withTenant — خروجی {start,end HH:MM,available}
- وضعیت‌ها: pending→confirmed(approve)→completed(markVisited)→reviewed(markReviewed)؛ pending→cancelled(reject)؛ cancel مشتری؛ no-show پنل+cron

## Payment
- PaymentService (payment.service.ts): FIRST_BOOKING_FEE=0.2؛ paymentsEnabled=PAYMENTS_ENABLED===true (default false)
- initiate: assertEnabled؛ pending؟؛ tx قبلی!failed→409؛ first=(captured==0)؛ platformFee=first?round(total*0.2):0؛ specialistShare=round(total*commissionRate/100)؛ salonShare=total-specialistShare؛ provider.createPaymentIntent→save Transaction pending + metadata{redirectUrl,isFirstBooking}
- completeZarinpalReturn(authority,status): status!=OK→null؛ eventId=zarinpal:authority؛ processed.findOne→findByAuthority؛ verify→failed یا transaction(captured+refId+save processed 'zarinpal.verified'+emit PAYMENT_CAPTURED)
- markRefundPending: tx؟؛ refunded→409؛ bookings.cancel()؛ refundAmount<=0→400؛ provider.refund→refunded+emit REFUND_MARKED
- Stripe Connect: ندارد (stripe فقط در package.json/config؛ هیچ import در src نیست؛ provider واقعی ZarinpalPaymentProvider)
- CommissionSplitService: ندارد (منطق split داخل initiate است)
- webhook جدا: ندارد؛ فقط GET /payments/zarinpal/callback?Authority&Status
- Idempotency: processed_webhook_events PK + چک captured + bookingId UNIQUE + verify code 100/101
- Zarinpal provider: POST request.json {merchant_id,amount,description,callback_url,metadata}→code100+authority→StartPay؛ verify.json→100/101؛ refund دستی (manual-intent، pending — پول واقعی برنمی‌گردد)
- گارد: PaymentFeatureFlag روی کل controller (503 اگر خاموش)

## Cancellation
- CancellationPolicyService.calculate (کامل): specialist_unavailable→100%؛ no_show→0%؛ hours>=24→100%؛ >=2→50%؛ else 0%؛ خروجی {refundPercentage,refundAmount:round,penaltyAmount:total-refund,reason fa}
- booking.cancel: قبلاً cancelled/completed→400؛ status=cancelled+emit BOOKING_CANCELLED{refundAmount}
- جریمه‌ها (تومان integer): 24h+ جریمه 0؛ 2-24h جریمه 50%؛ <2h جریمه 100%؛ no_show جریمه 100%
- no-show: پنل POST /salon/me/bookings/:id/no-show (confirmed→no_show فقط اگر lower(time_slot)<=NOW) + cron ReminderScheduler.detectNoShows هر 15min (confirmed+lower+30min<NOW+visitConfirmed NULL→no_show+no_show_count+1) + confirmVisitByCustomer برای توقف sweep

- **JWT refresh (ADR-009، ۲۰۲۶-۱۰-۰۵):** `JWT_REFRESH_SECRET` که قبلاً فقط تعریف شده بود و **مصرف نمی‌شد**، حالا فعال است. `POST /auth/otp/verify` دیگر `token` نمی‌دهد بلکه `accessToken` + `refreshToken` + `refreshExpiresAt`. جدول `refresh_tokens` (migration 1730000000031) user-scoped با `family_id` و RLS روی GUC جدید `app.current_user_id` (helper: `setUserContext` در `database/tenant-context.ts`)؛ فقط SHA-256 توکن ذخیره می‌شود. rotation اجباری با reuse detection: توکن revoke‌شده → کل family باطل. endpointها: `POST /auth/refresh` (public)، `POST /auth/logout` (public، 204)، `POST /auth/logout-all` (guard).
- دو باگ بحرانی که تست‌های integration پیدا کردند و رفع شد: (1) `rotate` داخل transaction throw می‌کرد و rollback می‌شد، پس **revoke خانواده بی‌اثر می‌شد و توکن سرقت‌شده زنده می‌ماند**؛ (2) `familyId` در `issue` hex خام و در `rotate` UUID canonical برمی‌گشت، پس یک خانواده دو مقدار متفاوت داشت.

## Flutter (3 اپ)
- customer_app (mobile/customer_app): مسیر main.dart با GoRouter + redirect auth (protected: /profile,/notifications,/referral,/loyalty)؛ state: flutter_riverpod Notifier (AuthController/AuthState{session,isRestoring,isLoading}، BookingController/BookingState، home_providers، profile_controller)؛ router: GoRouter (روت‌های /auth/login,/auth/otp,/booking,/booking/success,home,search,salon detail,notifications,profile)؛ Neshan: کد نمونه ندارد — هیچ import neshan در lib نیست (فقط dependency در shared)؛ API نمونه (کامل): Dio baseUrl http://localhost:3000/api/v1 + `AuthInterceptor` (Bearer از **secure storage**، refresh خودکار روی ۴۰۱ با single-flight، replay درخواست)؛ public: /auth/otp/send,/auth/otp/verify,/salons,/categories + /auth/* که هرگز refresh نمی‌شود؛ SalonsApi.getSalons/getCategories/getSalonById؛ AuthApi.sendOtp/verifyOtp؛ BookingController.submit→POST /bookings {tenantId,specialistId,serviceId,startsAt UTC,notes}
- salon_app (mobile/salon_app): مسیر main.dart (SalonApp + globalProviderContainer) + core/router/app_router.dart؛ state: flutter_riverpod (authControllerProvider)؛ router: GoRouter StatefulShellRoute.indexedStack (tabs: /dashboard,/bookings(+/bookings/calendar),/specialists,/finance,/profile + full-pages /salon/edit,/services/lines...,/specialists/new|edit|invite,/portfolio,/bookings/:id + redirect auth→/auth/login)؛ Neshan: کد نمونه ندارد؛ API نمونه: Dio + `AuthInterceptor` مشابه customer_app (refresh خودکار + single-flight)؛ session در **flutter_secure_storage** (`^11.2.0`) با مهاجرت از کلید قدیمی `salon_auth_session` در SharedPreferences؛ route guard نقش (ADR-008) در `core/router/app_router.dart` با allow-list `hasSalonAccess` هم‌تراز با `STAFF_ROLES` بک‌اند و صفحهٔ `/auth/forbidden`
- **onboarding متخصص در salon_app (ADR-010) — تکمیل شد:** فایل‌های جدید در `features/specialists/` — `data/invite_api.dart` (`POST /auth/invite` با `{phone, role}`؛ tenant از JWT، هرگز از کلاینت) و `presentation/screens/invite_specialist_screen.dart` (فرم شماره+نقش specialist/line_manager، نمایش یک‌بارهٔ توکن با دکمهٔ کپی). روت `/specialists/invite` و دکمهٔ «دعوت متخصص» در `specialist_list_screen.dart` (حالت خالی و پرشده). دو درِ ورود متمایزند: `POST /salon/me/specialists` فوری اکانت می‌سازد (بدون OTP)، این صفحه دعوت OTP-محور می‌فرستد.
- specialist_app (mobile/specialist_app): **حذف‌شده در ۲۰۲۶-۱۰-۰۵ طبق ADR-003** (تاریخچه: main.dart→app.dart SpecialistShell با StatefulWidget _index، بدون GoRouter — bottom NavigationBar ساده: dashboard/my-bookings/profile + schedule؛ state: ندارد؛ router: ندارد؛ API: ندارد — صفحات placeholder بودند). اکنون نقش specialist در salon_app سرویس می‌شود.
- shared (boya_shared): theme BoyaTheme/boya_colors/typography + localization fa/en + utils jalali/persian-number/text-direction + widgets boya_date_picker/boya_logo + boyaMaterialApp (fa-IR RTL)؛ Neshan/geolocator فقط dependency هستند، کد wrapper ندارد

## Admin-panel
- auth: Zustand store (`lib/stores/auth.ts`) با `persist` در localStorage زیر کلید `boya_admin_token`. **ADR-009:** state از `{token}` به `{accessToken, refreshToken, refreshExpiresAt, user}` تغییر کرد؛ `version: 1` با `migrate` که session قدیمیِ فقط-`token` را دور می‌ریزد (refresh token برایش قابل ساخت نیست، پس ادمین باید دوباره وارد شود). `setAuth({...})` و `setTokens({...})` جای `setAuth(token, user)` را گرفتند.
- refresh: در **axios response interceptor** (`lib/api/client.ts`)، نه `fetch` — چون کل پروژه axios است. روی ۴۰۱ (به‌جز مسیرهای `/auth/*`) یک rotation با single-flight (`refreshInFlight`) انجام می‌شود و همان درخواست با توکن جدید replay می‌شود. `readStoredTokens()` مستقیم از storage می‌خواند چون interceptor خارج از React ساخته می‌شود.
- logout: `useSignOut()` در `lib/api/sign-out.ts` — اول `POST /auth/logout` (revoke سمت سرور) و بعد پاک‌کردن local state. **قبلاً** `Sidebar` و `Topbar` فقط `logout()` محلی می‌زدند و refresh token روی مرورگر زنده می‌ماند.
- **invites (ADR-010) — تکمیل شد:** صفحه `src/app/[locale]/(protected)/invites/page.tsx` با `components/InviteTable.tsx` (لیست pending) و `components/InviteCreateDialog.tsx` (ساخت). کلاینت API در `src/lib/api/invites.ts` (`createInvite`/`listInvites`/`revokeInvite`). ورودی منو در `components/layout/nav-items.ts`؛ رشته‌های i18n در `messages/fa.json` + `messages/en.json` (fix i18n در InviteTable). سه عملیات create/list/revoke پوشش داده شده‌اند.
- **onboarding سالن (ADR-010) — تکمیل شد:** بک‌اند `POST /tenants` در `modules/tenant` (فقط `@Roles('admin')`؛ DTO `CreateTenantDto` با `name`+`slug`؛ تکراری‌بودن slug → ۴۰۹ `ConflictException`؛ سالن در وضعیت `draft` ساخته می‌شود). پنل: صفحهٔ `tenants/create/page.tsx` + `components/TenantForm.tsx` — مرحلهٔ ۱ `tenantsApi.createTenant` و مرحلهٔ ۲ `invitesApi.createInvite({role:'salon_owner'})` که توکن یک‌بارمصرف در دکمهٔ کپی نشان داده می‌شود؛ دکمهٔ «سالن جدید» در فهرست `tenants` و کلیدهای i18n در `messages/{fa,en}.json`. API پنل: `createTenant` در `lib/api/tenants.ts`.
- بدون setup تستی (نه jest نه vitest)؛ `tsc --noEmit` و `next build` پاس می‌شوند.

## Tests
- فایل‌ها backend/src (jest، rootDir src): modules/auth/otp.service.spec.ts، modules/common/jalali-date.service.spec.ts، modules/salon/salon.service.spec.ts، utils/jalali-date.util.spec.ts، utils/persian-number.util.spec.ts، utils/working-hours.util.spec.ts
- فایل‌ها backend/test (node:test، via test:e2e): app.e2e-spec.ts، auth.e2e-spec.ts، availability.service.spec.ts، cancellation-policy.service.spec.ts، in-app-notification.service.spec.ts، loyalty-point.service.spec.ts، otp.service.spec.ts، redis-otp.storage.spec.ts، referral-code.service.spec.ts
- موبایل: customer_app/test/{booking_flow,notifications_screen,widget}_test.dart؛ salon_app/test/salon_status_test.dart؛ shared/test/{boya_app,jalali_date_utils,persian_number_utils}_test.dart؛ (specialist_app در ۲۰۲۶-۱۰-۰۵ طبق ADR-003 حذف شد و تستی هم نداشت)
- integration (backend/test/integration، jest - `npm run test:integration`، نیازمند Postgres واقعی؛ بدون DB→skip مگر `INTEGRATION_DB_REQUIRED=true`): booking-exclusion، policy-guc، refresh-token، reminder-claim-due، reminder-scheduler، rls-isolation، tenant-context-gaps، **invite-token (۱۳ تست)**، **roles-guard (۴ تست)**، **tenant-onboarding (۳ تست)**، **specialist-onboarding (۳ تست)**
  - **roles-guard (4 تست، ADR-010):** زنجیره Guard روی مسیرهای invite با یک اپ HTTP حداقلی (بدون DB) — «بدون توکن→401 نه 403»، «customer→403 روی POST /auth/invite»، «admin→200 روی GET /auth/invite/list با tenant از query»، «admin بدون سالن→400 نه 403»
  - **invite-token (۱۳ تست، ADR-010):** قبلاً ۱۳ skip بود؛ اکنون با DB واقعی همگی pass — ذخیره فقط hash + بازگشت plaintext یک‌بار، bind نقش داخل tenant دعوت‌کننده، رد token منقضی/تکراری/ناموجود، لیست فقط pending یک tenant، revoke توسط صاحب/адmin و رد دیگران، ایزوله بودن tenant (RLS) + حضور policy `invite_tokens_tenant_isolation`
- چه تست شده: OTP (rate/verify/normalize)، اعداد فارسی/جلالی/working-hours slots، salon.service، loyalty/referral-code/cancellation/availability/in-app-notification (e2e سطح unit)، و integration واقعی: Exclusion، RLS/GUC، refresh-token rotation، reminder cronها، invite-token، **RolesGuard**
- چه تست نشده: Payment/Zarinpal (غیرفعال)، کل flow end-to-end با SMS واقعی (Kavenegar)، تست admin-panel
- آخرین نتیجه اجرا (npm test، 2026-10-03): 2 failed / 43 passed (6 suite): FAIL jalali-date.service.spec (expected 2024-03-20T20:30Z received 2024-03-19T20:30Z) + FAIL otp.service.spec (sms.verify calls 0 — DEV MODE زود return می‌کند)؛ PASS چهارتای دیگر
- **آخرین اجرا integration (۱۳۹۵/… → 2026-10-06): 11 suite / 45 test همگی pass** با Postgres واقعی روی `beauty_platform_test` و `INTEGRATION_DB_REQUIRED=true`؛ invite-token ۱۳/۱۳ pass، roles-guard ۴/۴ pass، specialist-onboarding ۳/۳ pass. `tsc --noEmit` + `eslint --max-warnings 0` بک‌اند هم پاس؛ `flutter analyze` (salon_app) بدون issue و `flutter test` همه pass.

## Issues
- TODO/FIXME: در src بکند و lib موبایل صفر (جستجوی TODO|FIXME|HACK|XXX: فقط placeholder UI، mock-jest، limitPlaceholder متغیر — هیچ TODO واقعی نیست)
- mock: mobile/customer_app/lib/features/home/data/mock_salons.dart (5 سالن picsum + 13 کategori — «No backend call»)؛ migration 1730000000017 mock CDN portfolio (dev-only)؛ jest mocks در otp.spec؛ admin-panel PlaceholderPage برای settings
- خطاهای باز: تست جلالی off-by-one روز؛ تست OTP در DEV SMS نمی‌فرستد؛ ناسازگاری پورت README(5432/6379) با compose(5433/6380)؛ دو املای GUC (app.tenant_id در برابر app.current_tenant_id)؛ README ادعای Stripe Connect می‌کند ولی کد Zarinpal است؛ web/ خالی (No login seeded، پنل‌ها ساخته نشده)
- تست‌های fail: 2 عدد بالا (jalali-date.service.spec، otp.service.spec)؛ test:e2e اجرا نشد (نیاز به DB/Redis واقعی)

## Env
- backend/.env.example (نام‌ها بدون مقدار): NODE_ENV، PORT، API_PREFIX، DATABASE_HOST/PORT/USER/PASSWORD/NAME/SSL، REDIS_HOST/PORT/PASSWORD، JWT_ACCESS_SECRET/TTL، JWT_REFRESH_SECRET/TTL، STRIPE_SECRET_KEY، STRIPE_WEBHOOK_SECRET، STRIPE_CONNECT_CLIENT_ID، PAYMENTS_ENABLED، KAVENEGAR_API_KEY/SENDER/OTP_TEMPLATE/BOOKING_TEMPLATE، OTP_PEPPER، FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY، NESHAN_API_KEY، CORS_ORIGINS
- env.validation.ts الزامی‌ها: DATABASE_HOST/USER/PASSWORD/NAME، REDIS_HOST، JWT_ACCESS_SECRET/REFRESH_SECRET، STRIPE_SECRET_KEY/WEBHOOK_SECRET، KAVENEGAR_API_KEY، OTP_PEPPER (بقیه optional؛ PAYMENTS_ENABLED default false)
- موبایل: API_BASE_URL via --dart-define (default http://localhost:3000/api/v1)

## Risks
- **refresh token در localStorage (admin-panel):** مرورگر keystore ندارد، پس برخلاف دو اپ موبایل، refresh token (بلندعمر، یک‌بارمصرف) در `localStorage` است و **هر XSS آن را می‌دزدد**. راه درست httpOnly cookie است که تغییر بک‌اند می‌خواهد (Set-Cookie در `verifyOtp` + CORS با credentials). عمداً به فاز ۲ موکول شده — BACKLOG.md بخش A.
- 3 ریسک اصلی: (1) دو GUC متفاوت tenant — اگر یک SET جا بیفتد RLS ساکت صفر برمی‌گرداند یا WITH CHECK می‌شکند (**رفع‌شده با migration 0027 که همه را روی `app.current_tenant_id` یکسان کرد؛ برای جدول‌های user-scoped مثل `refresh_tokens` یک GUC جدید `app.current_user_id` لازم شد**)؛ (2) refund دستی Zarinpal — markRefundPending وضعیت refunded می‌زند ولی پول واقعی جابه‌جا نمی‌شود (Phase 2 باید settlement واقعی بیاورد)؛ (3) ~~تست‌های قرمز + بدون integration~~ — **رفع‌شده**: ۲ تست قرمز سبز شدند و integration با DB واقعی اضافه و در CI اجرا می‌شود
- 3 بخش نامطمئن: (1) ادعای README درباره Stripe Connect در برابر کد Zarinpal — کدام برای مشاور مبناست؟؛ (2) پورت واقعی DB/Redis برای مشاور (compose در برابر README/.env) — CI و compose اکنون روی ۵۴۳۳/۶۳۸۰ هم‌تراز شدند؛ (3) آیا reminder.scheduler سطر users JOIN tenants درست است وقتی مشتری tenant_id NULL دارد (phone lookup ممکن است خالی بماند)
- شروع‌نشده: web/ پنل‌ها (خالی)، writer برای portfolio_images، ~~route guard نقش specialist~~ (**بسته شد — ADR-008**)، settlement/refund واقعی، seed لاگین، CI موبایل، **httpOnly cookie برای refresh در admin-panel**، **تست برای admin-panel**






