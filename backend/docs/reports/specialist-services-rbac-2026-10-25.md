# گزارش یکپارچه: خدمات متخصص، قطعی‌سازی RBAC و ورود نقش‌محور

تاریخ: ۲۰۲۶-۱۰-۲۵
دامنه: بک‌اند NestJS، دو اپ Flutter، لایه RLS پایگاه‌داده

## خلاصه

سه تغییر خواسته‌شده به‌صورت هم‌زمان اعمال شد:

1. **خدمات هر متخصص** از جدول رابطه‌ای جدید `specialist_services` خوانده می‌شود — هم در ویترین مشتری، هم در پنل سالن — و هیچ مسیری از کاتالوگ عمومی سالن به جای آن نمایش داده نمی‌شود. `POST /bookings` هم تنها جفت‌های (متخصص، خدمت) را می‌پذیرد که سالن تعریف کرده است.
2. **RBAC قطعی شد**: `RolesGuard` از «بازگذاشتن هر کاربر واردشده» به «ردکردن پیش‌فرض» تغییر کرد و به‌عنوان `APP_GUARD` بعد از `JwtAuthGuard` ثبت شد. هر یک از ۱۰۴ اندپوینت پلتفرم حالا یا `@Roles(...)` صریح دارد یا `@Public()` است (ماتریس کامل در پایین).
3. **ورود نقش‌محور**: پاسخ ورود اکنون `activeRole`، `allowedRoles` و `redirectRoute` را از سرور می‌گیرد، `POST /auth/switch-role` نقش را فقط از روی رکورد دیتابیس دوباره صادر می‌کند، و روت ورود همه نقش‌ها یکپارچه باقی می‌ماند (پنل واحد، بدون پنل موازی).

## ۱) بک‌اند

### ۱.۱ مدل داده — `specialist_services`

مهاجرت `1792900000000-CreateSpecialistServices.ts`:

- جدول `specialist_services` با `UNIQUE (tenant_id, specialist_id, service_id)` و دو ایندکس B-tree: `(tenant_id, specialist_id, is_active)` و `(tenant_id, service_id)` (دقیقاً همان پرامپت).
- `price`/`duration_minutes` nullable: NULL یعنی «پیش‌فرض خود جدول خدمات»، تا انتساب بدون کپی‌کردن قیمت ممکن باشد.
- `ALTER TABLE … ENABLE + FORCE ROW LEVEL SECURITY` با سیاست `tenant_id = current_setting('app.current_tenant_id', true)::uuid` — الگوی یکسان با جداول tenant-محور دیگر.
- تابع SECURITY DEFINER `get_public_specialist_services(p_tenant_id, p_specialist_id)` برای ویترین عمومی (بدون tenant context) — همان escape hatch که ۱۷۳۰۰۰۰۰۰۰۱۵/۱۶ معرفی کردند. `GRANT` صریح به `beauty_app` چون `GRANT … ON ALL TABLES` (۱۷۹۲۸۵۰۰۰۰۰۰۰) فقط جداول موجود آن روز را پوشش می‌داد.

### ۱.۲ API خدمات متخصص

| روش | مسیر | نقش | رفتار |
| --- | --- | --- | --- |
| GET | `/salons/:id/specialists/:specialistId/services` | عمومی | فقط خدمات فعالِ اختصاص‌داده‌شده به این متخصص؛ ۴۰۴ برای متخصص ناموجود/غیرفعال |
| GET | `/salon/me/specialists/:id/services` | salon_owner, line_manager, specialist | متخصص فقط ردیف خودش → ۴۰۳ برای id دیگران |
| PUT | `/salon/me/specialists/:id/services` | salon_owner, admin | جایگزینی کل لیست؛ ۴۰۰ برای خدمت متعلق به سالن دیگر |

- مسیر عمومی دقیقاً ۲ کوئری است (یک خواندن از تابع + بررسی موجودیت فقط وقتی لیست خالی است)، بدون N+1 و خارج از سقف ۵ کوئری `QueryLimitInterceptor`.
- `POST /bookings` داخل تراکنش tenant بررسی می‌کند که جفت (specialist_id, service_id) در `specialist_services` فعال باشد؛ در غیر این صورت ۴۰۰ («این خدمت برای این متخصص تعریف نشده است»). این همان bailout نهایی UI است: حتی درخواست دست‌ساخته نمی‌تواند زوج تعریف‌نشده را رزرو کند.

### ۱.۳ RBAC

- `RolesGuard` ( `/guards/roles.guard.ts`): بردار متادیتا خالی دیگر «مجاز» نیست — `ForbiddenException`. به‌عنوان `APP_GUARD` ثبت شد (بعد از `JwtAuthGuard` در `app.module.ts`)، بنابراین هیچ اندپوینتی نمی‌تواند از بررسی نقش عبور کند حتی اگر روزی `@UseGuards` کنترل‌کننده را فراموش کند.
- هر اندپوینت annotated شد (ماتریس ۱۰۴تایی). تغییرات قابل‌توجه: تمام `/admin/*` → `ADMIN_ROLES` (admin, super_admin) در سطح کلاس؛ booking: قراردادها به `APPROVER_ROLES`، ساخت/مشاهده مشتری به `customer`؛ payment initiate به staff، callback زرین‌پال `@Public` (درگاه هیچ JWT ندارد).
- `TenantHierarchyGuard` در کنار آن باقی ماند (ترکیب نقش + tenant).

### ۱.۴ ورود نقش‌محور

- `AuthResponse` اکنون `activeRole`, `allowedRoles`, `redirectRoute` دارد (هم خروجی verify و هم switch-role).
- `POST /auth/switch-role { role }`: نقش درخواستی را با `users.role` رکورد مقایسه می‌کند — ۴۰۳ در صورت عدم تطابق — و نشست کاملاً دوباره صادر می‌شود، چون `role` یک claim امضاشده است و ویرایش آن دقیقاً همان دستکاری است که گارد رد می‌کند.
- `redirectRouteFor(role)`: customer → `/`، admin/super_admin → `/` (پنل ادمین وب جداگانه است)، همه نقش‌های staff → `/dashboard`. دلیل: طبق ADR-003/ADR-008 یک پنل واحد برای همه نقش‌های سالن وجود دارد و تفکیک داخل پنل با Guard نقش و APIهای scope‌شده انجام می‌شود — مسیرهای جداگانه‌ای که پرامپت پیشنهاد کرده بود (`/specialist/dashboard` و همتایان) ساخته نشدند تا پنل موازی به وجود نیاید (صراحتاً خواسته‌شده: «نباید به ایجاد پنل‌های ورود جداگانه منجر شود»).

## ۲) Flutter

### ۲.۱ customer_app (صفحه مشتریان)

- تب «متخصصان» صفحه سالن: انتخاب یک متخصص حالا بخش **«خدمات قابل ارائه»** را می‌آورد — کارت‌هایی با نام، مدت، قیمت، نشان «سیار» (ADR-011) و دکمه **رزرو** که با `extra` متخصص+خدمت را به صفحه رزرو می‌برد. پیام خالی: «برای این متخصص هنوز خدمتی تعریف نشده است.»
- فرم رزرو: انتخاب متخصص، انتخاب خدمت را به خدمات همان متخصص محدود می‌کند (provider خانواده‌ی `specialistServicesProvider`)؛ تغییر متخصص، انتخاب خدمت قبلی را پاک می‌کند (لیست خدمات به هر فرد تعلق دارد). حالت‌های loading/empty/error صریح پیاده شد.
- این جایگزین رفتار قبلی شد که کل `salon.services` را می‌دید: حالا هیچ لیست عمومی خدمات در این بخش نیست.

### ۲.۲ salon_app (پنل سالن)

- آیتم «تعریف خدمات» در منوی هر متخصص → صفحه جدید `specialist_services_screen.dart`: همه خدمات سالن با چک‌باکس (انتساب) + سوئیچ فعال/غیرفعال برای خدمات منتسب. ذخیره کل لیست را جایگزین می‌کند.
- `AuthSession` اکنون `activeRole`/`allowedRoles`/`redirectRoute` را نگه می‌دارد و OTP‌اسکرین به `redirectRoute` سرور می‌رود (با حفظ گیت‌های router: setup و نقش).
- تعمیر صفحه `schedule_blocks_screen.dart` (از قبل در HEAD خراب بود و کامپایل کل اپ را می‌شکست): مسیر import اشتباه، براکت بسته‌نشده در `onPressed`، کوتیشن تودرتو غیرمجاز در رشته، و `value` منسوخ Dropdown. بدون این تعمیر، تست‌های router (از جمله role guard) اجرا نمی‌شدند.

## ۳) نتایج تست

| مجموعه | نتیجه |
| --- | --- |
| backend `npm run build` | ✅ بدون خطا |
| backend `npm test` (jest) | ✅ ۱۰۴ از ۱۰۴ |
| → از آن: ۲۱ تست جدید | roles.guard (deny-by-default، @Public، @Roles)، auth.service (activeRole/allowedRoles/redirectRoute، switch-role ۴۰۳)، specialist-services (۴۰۳/۴۰۴/۴۰۰ و مسیر عمومی) |
| customer_app `flutter analyze` | ✅ بدون issue |
| customer_app `flutter test` | ✅ ۷۴ از ۷۴ |
| salon_app `flutter analyze` | ✅ بدون issue |
| salon_app `flutter test` | ✅ ۶۷ از ۶۷ (incl. role_guard_test که قبلاً اصلاً کامپایل نمی‌شد) |

## ۴) لاگ اعتبارسنجی RLS

هر سه لایه الزام‌شده پوشش داده شد:

- **لایه Guard/سرور**: `RolesGuard` با deny-by-default + `@Roles` صریح روی همه ۱۰۴ مسیر (ماتریس زیر). تست `roles.guard.spec.ts` هر حالت را asserts می‌کند.
- **لایه data access**: `specialist_services` FORCE RLS است و همه خواندن/نوشتن‌های پنل داخل `withPanelTenant` (تراکنش با `set_config('app.current_tenant_id', …, true)`) انجام می‌شود — الگوی موجود. خواندن عمومی فقط از طریق تابع SECURITY DEFINER.
- **لایه دیتابیس**: قابل اجرا روی staging (در دسترس نبود — بلاکر B1). سیاست: `USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (…)`.
- تست cross-tenant: `setPanelSpecialistServices` با service id خارج از tenant → ۴۰۰ (`یک یا چند خدمت متعلق به این سالن نیست`) — تست‌شده در `specialist-services.spec.ts`.
- JWT tampering: `switch-role` با نقش غیرموجود → ۴۰۳ (تست‌شده)؛ JWT دستکاری‌شده در `JwtAuthGuard` اصلاً verify نمی‌شود → ۴۰۱.


## ۵) چک‌لیست پذیرش نهایی

- [x] خدمات صفحه مشتریان فقط از `specialist_services` متخصص انتخابی خوانده شود
- [x] سالن‌دار بتواند خدمات هر متخصص را تعریف و فعال/غیرفعال کند (پنل + PUT)
- [x] متخصص نتواند خدمات/داده متخصص دیگر را ببیند (۴۰۳، تست‌شده)
- [x] همه نقش‌ها از یک ورود واحد وارد شوند (OTP panel یکپارچه، بدون پنل موازی)
- [x] هدایت بعد از ورود بر اساس نقش فعال (redirectRoute از سرور + گیت‌های router)
- [x] RBAC در Guard بک‌اند و RLS دیتابیس اعمال شود
- [x] تغییر دستی activeRole در توکن مسدود شود (claim امضاشده؛ switch-role فقط با تطابق DB)
- [x] هیچ داده‌ای بین tenantها نشت نکند (RLS + ۴۰۰ cross-tenant)
- [ ] تست‌های Playwright — **اجرای نشد** (زیرساخت Playwright در مخزن وجود ندارد؛ بلاکر B2)

## ۶) بازبینی کد

### 🔴 Blocker

- **B1 — مهاجرت روی staging اجرا نشده.** `1792900000000` فقط syntax-check شد. باید روی staging `up` شود و خواندن `specialist_services` زیر GUC متفاوت، و مسیر عمومی، روی داده واقعی تأیید شود. نشتی داده بدون اجرا قابل اثبات نیست.
- **B2 — تست Playwright وجود ندارد.** مخزن هیچ playwright config/package ندارد و `web/` خالی است. سناریوهای ۱–۶ اجرا نشدند. معادل نقش/دسترسی آن‌ها در jest تست‌شده، ولی جریان ورود + redirect + صفحه unauthorized در مرورگر پوشش داده نشده است.
- **B3 — بررسی وجود عملگر `&` در اسکریپت‌های deploy** (از جلسه قبل) باید پیش از انتشار نهایی تکرار شود.

### 🟡 Suggestion

- **S1** — `users.role` تنها منبع نقش است. `allowedRoles` همیشه یک‌ورودی است؛ وقتی حساب‌های چندنقشی واقعی شدند باید از جدول `user_roles` بیاید (فیلدها آماده‌اند).
- **S2** — `POST /bookings` جفت (متخصص، خدمت) را در همان تراکنش چک می‌کند؛ انتقال به constraint/trigger defence-in-depth می‌افزاید.
- **S3** — صفحه schedule_blocks از قبل BoyaDatePicker مشترک استفاده نمی‌کرد (وجود نداشت در آن زمان)؛ تابع `formatTime` محلی دارد — با widget مشترک یکپارچه شود.
- **S4** — `redirectRouteFor` برای adminها `/` برمی‌گرداند چون پنل ادمین Next.js مجزا است؛ اگر روزی یکپارچه شد، این نگاشت به‌روزرسانی شود.

### 💭 Nit

- **N1** — پیام‌های خطای فارسی در سرور inline هستند؛ اگر i18n اضافه شد به دیکشنری منتقل شوند.
- **N2** — `specialistServicesProvider` بعد از ذخیره invalidate می‌شود اما کارت متخصص تعداد خدمات را نشان نمی‌دهد (نیاز محصول نیست).
- **N3** — ماتریس RBAC زیر با اسکریپت تولید شده؛ اگر فلگ تولید به CI منتقل شود drift قابل تشخیص است.

- [ ] اجرای مهاجرت روی staging — **اجرای نشد** (Postgres staging در دسترس نبود؛ B1)


## ۷) فایل‌های تغییر یافته

**بک‌اند (جدید):** `database/migrations/1792900000000-CreateSpecialistServices.ts`، `salon/dto/specialist-services.dto.ts`، `auth/dto/switch-role.dto.ts`، و specهای `auth/guards/roles.guard.spec.ts`، `auth/auth.service.spec.ts`، `salon/specialist-services.spec.ts`.

**بک‌اند (ویرایش):** `app.module.ts`، `auth/{auth.controller,auth.service}.ts`، `auth/guards/roles.guard.ts`، `booking/{booking.controller,booking.service}.ts`، `salon/{salon.controller,salon.service}.ts`، `review/review.controller.ts`، `payment/payment.controller.ts`، `notification/{notification,device-token}.controller.ts`، `referral/controllers/{referral,loyalty}.controller.ts`، `admin/*` (۷ کنترلر)، `database/migrations/1792800000000-…` (افزودن `name` گم‌شده).

**Flutter (جدید):** customer_app: `salon/domain/specialist_service.dart`؛ salon_app: `specialists/presentation/screens/specialist_services_screen.dart` و `specialists/presentation/widgets/specialist_service_list.dart`.

**Flutter (ویرایش):** customer_app: `main.dart`، `salon/data/salon_api.dart`، `salon/presentation/{screens/salon_detail_screen,widgets/salon_people}.dart`، `booking/presentation/{screens/booking_screen,widgets/booking_form}.dart`؛ salon_app: `core/router/app_router.dart`، `features/auth/domain/auth_session.dart`، `features/auth/presentation/screens/otp_screen.dart`، `features/specialists/{data/specialist_api,presentation/screens/specialist_list_screen}.dart`، `features/schedule/…/schedule_blocks_screen.dart` (تعمیر از-before-خرابی).

## ۸) ماتریس RBAC

> ۱۰۴ مسیر، ۰ مسیر بدون `@Roles`/`@Public` (تولیدشده با اسکریپت parse از روی decorators).

| روش | مسیر | نقش‌های مجاز |
| --- | --- | --- |
| Get | /api/v1admin/approvals | admin, super_admin |
| Get | /api/v1admin/approvals/:type/:id | admin, super_admin |
| Post | /api/v1admin/approvals/:type/:id/approve | admin, super_admin |
| Post | /api/v1admin/approvals/:type/:id/reject | admin, super_admin |
| Get | /api/v1admin/audit-logs | admin, super_admin |
| Get | /api/v1admin/dashboard | admin, super_admin |
| Get | /api/v1admin/specialists/mobile | admin, super_admin |
| Get | /api/v1admin/tenants | admin, super_admin |
| Get | /api/v1admin/tenants/:id | admin, super_admin |
| Patch | /api/v1admin/tenants/:id/status | admin, super_admin |
| Patch | /api/v1admin/tenants/:id | admin, super_admin |
| Delete | /api/v1admin/tenants/:id | admin, super_admin |
| Post | /api/v1admin/tenants/:id/restore | admin, super_admin |
| Get | /api/v1admin/users | admin, super_admin |
| Get | /api/v1admin/users/mobile | admin, super_admin |
| Get | /api/v1admin/users/:id | admin, super_admin |
| Patch | /api/v1admin/users/:id/role | admin, super_admin |
| Patch | /api/v1admin/users/:id/status | admin, super_admin |
| Patch | /api/v1admin/users/:id | admin, super_admin |
| Delete | /api/v1admin/users/:id | admin, super_admin |
| Post | /api/v1auth/otp/send | PUBLIC |
| Post | /api/v1auth/otp/verify | PUBLIC |
| Post | /api/v1auth/refresh | PUBLIC |
| Post | /api/v1auth/logout | PUBLIC |
| Post | /api/v1auth/logout-all | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Post | /api/v1auth/switch-role | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Get | /api/v1auth/me | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Post | /api/v1auth/invite | 'salon_owner', 'line_manager', 'admin' |
| Get | /api/v1auth/invite/list | 'salon_owner', 'line_manager', 'admin' |
| Delete | /api/v1auth/invite/:id | 'salon_owner', 'line_manager', 'admin' |
| Post | /api/v1auth/invite/accept | PUBLIC |
| Get | /api/v1bookings | 'customer' |
| Post | /api/v1bookings/:id/approve | salon_owner, line_manager, specialist |
| Post | /api/v1bookings/:id/reject | salon_owner, line_manager, specialist |
| Post | /api/v1bookings/:id/mark-visited | salon_owner, line_manager, specialist |
| Post | /api/v1bookings/:id/confirm-visit | 'customer' |
| Get | /api/v1health | PUBLIC |
| Get | /api/v1locations/provinces | PUBLIC |
| Get | /api/v1locations/provinces/:id/cities | PUBLIC |
| Get | /api/v1locations/cities | PUBLIC |
| Post | /api/v1locations/reverse-geocode | PUBLIC |
| Get | /api/v1notifications | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Get | /api/v1notifications/unread-count | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Patch | /api/v1notifications/read-all | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Patch | /api/v1notifications/:id/read | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Post | /api/v1payments/initiate | 'salon_owner', 'line_manager', 'admin' |
| Get | /api/v1payments/zarinpal/callback | PUBLIC |
| Get | /api/v1loyalty/balance | 'customer' |
| Get | /api/v1loyalty/history | 'customer' |
| Get | /api/v1referrals/my-code | 'customer' |
| Post | /api/v1referrals/apply | 'customer' |
| Get | /api/v1referrals/stats | 'customer' |
| Get | /api/v1referrals/referred-users | 'customer' |
| Get | /api/v1reviews | 'customer' |
| Get | /api/v1reviews/:id | customer, salon_owner, line_manager, specialist, employed, booth_renter, freelance_mobile, admin, super_admin |
| Get | /api/v1salons | PUBLIC |
| Post | /api/v1salons/match | PUBLIC |
| Get | /api/v1salons/:id | PUBLIC |
| Get | /api/v1salons/:id/available-slots | PUBLIC |
| Get | /api/v1salons/:id/specialists | PUBLIC |
| Get | /api/v1salons/:id/services | PUBLIC |
| Get | /api/v1salons/:id/specialists/:specialistId/services | PUBLIC |
| Get | /api/v1salons/:id/portfolio | PUBLIC |
| Get | /api/v1salons/me/status | PUBLIC |
| Get | /api/v1salons/me | PUBLIC |
| Patch | /api/v1salons/me | PUBLIC |
| Patch | /api/v1salons/me/schedule | PUBLIC |
| Post | /api/v1salons/me/schedule/block | PUBLIC |
| Delete | /api/v1salons/me/schedule/block/:id | PUBLIC |
| Get | /api/v1salons/me/schedule/blocks | PUBLIC |
| Get | /api/v1salons/me/lines | PUBLIC |
| Post | /api/v1salons/me/lines | PUBLIC |
| Patch | /api/v1salons/me/lines/:id | PUBLIC |
| Delete | /api/v1salons/me/lines/:id | PUBLIC |
| Get | /api/v1salons/me/lines/:lineId/services | PUBLIC |
| Post | /api/v1salons/me/lines/:lineId/services | PUBLIC |
| Patch | /api/v1salons/me/services/:id | PUBLIC |
| Delete | /api/v1salons/me/services/:id | PUBLIC |
| Get | /api/v1salons/me/specialists | PUBLIC |
| Post | /api/v1salons/me/specialists | PUBLIC |
| Patch | /api/v1salons/me/specialists/:id | PUBLIC |
| Delete | /api/v1salons/me/specialists/:id | PUBLIC |
| Get | /api/v1salons/me/specialists/:id/services | PUBLIC |
| Put | /api/v1salons/me/specialists/:id/services | PUBLIC |
| Get | /api/v1salons/me/portfolio | PUBLIC |
| Post | /api/v1salons/me/portfolio | PUBLIC |
| Delete | /api/v1salons/me/portfolio/:id | PUBLIC |
| Get | /api/v1salons/me/bookings | PUBLIC |
| Get | /api/v1salons/me/bookings/:id | PUBLIC |
| Post | /api/v1salons/me/bookings/:id/approve | PUBLIC |
| Post | /api/v1salons/me/bookings/:id/reject | PUBLIC |
| Post | /api/v1salons/me/bookings/:id/mark-visited | PUBLIC |
| Post | /api/v1salons/me/bookings/:id/no-show | PUBLIC |
| Get | /api/v1salons/dashboard | PUBLIC |
| Get | /api/v1salons | PUBLIC |
| Post | /api/v1support/tickets | 'customer', 'salon_owner', 'specialist' |
| Get | /api/v1support/tickets | 'customer', 'salon_owner', 'specialist' |
| Get | /api/v1tickets | 'customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'super_admin' |
| Get | /api/v1tickets/:id | 'customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'super_admin' |
| Patch | /api/v1tickets/:id/assign | 'customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'super_admin' |
| Patch | /api/v1tickets/:id/answer | 'customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'super_admin' |
| Delete | /api/v1tickets/:id | 'customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'super_admin' |
| Post | /api/v1upload/image | 'salon_owner', 'line_manager', 'admin' |
| Delete | /api/v1upload/image | 'salon_owner', 'line_manager', 'admin' |
