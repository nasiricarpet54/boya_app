# DECISIONS — تصمیمات معماری پروژه BOYA

تاریخ شروع: 2026-10-03
فرمت: هر تصمیم = تاریخ | وضعیت | زمینه | تصمیم | پیامد (ADR کوتاه). متن «تصمیم» بدون تغییر از سمت ذینفعان آمده است.

---

## ADR-001

- تاریخ: 2026-10-03
- وضعیت: پذیرفته
- زمینه: policyهای RLS امروز دو نام GUC دارند (bookings روی `app.tenant_id`، بقیه روی `app.current_tenant_id`) و helper فعلی `setTenantContext` مقدار `app.tenant_id` می‌زند؛ نیاز به یک استاندارد واحد است.
- تصمیم: ADR-001: GUC استاندارد = app.current_tenant_id + NULLIF(...,'')::uuid. حذف app.tenant_id از کل کد.
- پیامد: یک migration جدید برای بازنویسی هر policy به نام جدید + بروزرسانی `backend/src/database/tenant-context.ts`، اسکریپت‌ها و کامنت‌ها؛ معیار پذیرش این است که grep روی `app.tenant_id` صفر شود. نکته: کد فعلی هنوز `app.tenant_id` است؛ این ADR هنوز اجرا نشده.

## ADR-002

- تاریخ: 2026-10-03
- وضعیت: پذیرفته
- زمینه: OTP (ioredis)، Bull و کش هم‌اکنون به یک Redis واحد وصل‌اند؛ `maxmemory-policy` در سطح instance تنظیم می‌شود و با DB number قابل تفکیک نیست، پس اشباع کش می‌تواند کلیدهای OTP/Bull را دور بریزد (یا بالعکس).
- تصمیم: ADR-002: Redis = دو instance جدا. OTP+Bull روی noeviction، کش روی allkeys-lru. جداسازی با DB number کافی نیست چون maxmemory-policy در سطح instance است.
- پیامد: دو سرویس redis در docker-compose با پورت‌های جدا، دو ست env (برای OTP/Bull و برای کش)، پیکربندی AuthModule/BullModule/CacheModule روی instanceهای مجزا؛ روی noeviction اشباق حافظه به‌جای purge خطا می‌دهد — سقف OTP باید کوچک و پایش‌شده بماند.

## ADR-003

- تاریخ: 2026-10-03
- وضعیت: پذیرفته
- زمینه: سه اپ Flutter (customer/salon/specialist) برای یک نفر نگهدارنده؛ `specialist_app` هم‌اکنون بدون API client و بدون router و فقط با صفحات placeholder است.
- تصمیم: ADR-003: حذف specialist_app جدا و ادغام در salon_app با UI مبتنی بر نقش. دلیل: نگهداری سه اپ برای یک نفر غیرعملی.
- پیامد: حذف `mobile/specialist_app`؛ نقش specialist با route guard مبتنی بر JWT role به salon_app اضافه می‌شود؛ pubspec و CI موبایل به دو اپ کاهش می‌یابد.
- اجرا شد در 2026-10-05: پوشه `mobile/specialist_app` حذف شد (ADR-003). ⚠️ **بخش route guard هنوز انجام نشده** — `salon_app/lib/core/router/app_router.dart` فقط `isAuthenticated` را چک می‌کند و نقش را نمی‌خواند، پس حساب `specialist` امروز کل UI سالن‌دار (شامل finance و مدیریت متخصصان) را می‌بیند. این باید قبل از عرضهٔ فاز محصول بسته شود (BACKLOG.md، فاز ۲).

## ADR-004

- تاریخ: 2026-10-03
- وضعیت: پذیرفته
- زمینه: PROJECT_CHARTER فاز ۱ را ویترین رایگان تعریف می‌کند (بدون پرداخت آنلاین، بدون کمیسیون، بدون escrow)؛ درگاه Zarinpal نصب ولی غیرفعال است.
- تصمیم: ADR-004: تعویق Phase 2 (پرداخت واقعی). PAYMENTS_ENABLED=false تا اثبات تقاضا در بتا.
- پیامد: هر endpoint پرداخت 503 می‌ماند؛ `PaymentService`/provider فقط در درخت کد نگه داشته می‌شود؛ هیچ توسعه درگاه (از جمله Stripe) تا تأیید تقاضا در بتا.

## ADR-005

- تاریخ: 2026-10-03
- وضعیت: پذیرفته
- زمینه: `users.tenant_id` از migration 1730000000007 nullable شده (مشتری چندسالنه)، اما policy فعلی `users_tenant_isolation` فقط برابری `tenant_id` با GUC را چک می‌کند؛ ردیف کاربرِ بدون tenant (NULL) دیده نمی‌شود — باگ خاموشِ فعلی.
- تصمیم: ADR-005: users.tenant_id می‌تواند NULL باشد (مشتری چندسالنه). policy users باید شامل OR id = current_setting('app.current_user_id', true)::uuid باشد. (رفع باگ خاموش فعلی)
- پیامد: policy جدید `users` با شرط OR روی `app.current_user_id`؛ set کردن transaction-local آن کنار GUC tenant در تراکنش‌های مربوط به کاربر؛ تست ایزولاسیون الزامی می‌شود (به ADR-006).

## ADR-006

- تاریخ: 2026-10-03
- وضعیت: پذیرفته
- زمینه: دو تست قرمز (`jalali-date.service.spec` و `otp.service.spec`) بدون هیچ تست integration؛ هیچ تستی RLS و Exclusion Constraint را با DB واقعی پوشش نمی‌دهد.
- تصمیم: ADR-006: تست harness با DB واقعی قبل از fix تست‌های قرمز. ترتیب: harness → تست ایزولاسیون/23P01 → تست‌های قرمز.
- پیامد: ابتدا harness اجرا (docker compose + migrations + اجرای تست‌ها روی DB)، سپس تست‌های ایزولاسیون tenant و خطای 23P01، در پایان رفع تست‌های قرمز؛ CI باید postgres/redis سرو کند.

---

## ADR-007: SECURITY DEFINER pattern (2026-10-05)

**زمینه:** @Cron بدون GUC اجرا میشود؛ FORCE RLS روی bookings/users صفر برمیگرداند.

**تصمیم:** هر تابع cross-tenant:
- SECURITY DEFINER + SET search_path = public, pg_temp
- REVOKE ALL FROM PUBLIC
- GRANT EXECUTE فقط به beauty_app
- فقط داده اسکوپشده برمیگرداند (نه کل جدول)

**پیامد:** الگوی واحد برای توابع 0028/0029/0030 و آینده.

**تست:** هر تابع یک integration test با DB واقعی.

**Audit (2026-10-05):** در DB زنده ۲۲ تابع `SECURITY DEFINER` وجود دارد و **هر ۲۲ تا** `SET search_path = public, pg_temp` دارند؛ هیچ‌کدام فاقد آن نیستند
(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND NOT (p.proconfig @> ARRAY['search_path=public, pg_temp'])` → ۰ ردیف).

**درس audit:** grep ایستا روی متن migration قابل اعتماد نیست و می‌تواند هشدار کاذب بدهد. `1730000000008` تابع را بدون `search_path` ساخته بود، ولی `1730000000013`
همان تابع را `DROP` و با `search_path` از نو `CREATE` کرد — پس بدنهٔ `0008` دیگر در هیچ DBای وجود ندارد و lineage واقعی `0008 → 0013` است.
**قاعده:** وضعیت امنیتی توابع را از `pg_proc` (مرجع حقیقت) بسنج، نه از متن migration.

---

## ADR-008: Role-based route guard در salon_app (2026-10-05)

**زمینه:** پیامد باقی‌ماندهٔ ADR-003 این بود که نقش specialist باید با route guard مبتنی بر JWT به salon_app اضافه شود، ولی تا امروز انجام نشده بود: `redirect` در `app_router.dart` فقط `auth.isAuthenticated` را چک می‌کرد. نتیجه: هر کاربری که OTP تأییدشده داشت — حتی `customer` — کل پنل سالن را می‌دید، شامل `finance`، مدیریت متخصصان و خطوط خدمات. ضمناً `auth_controller.verifyOtp` فقط نقش `customer` را رد می‌کرد، و آن هم فقط در لحظهٔ ورود؛ یک سشن کش‌شده بدون هیچ بررسی نقشی از guard عبور می‌کرد.

**تصمیم:** گارد در `redirect`، در هر بار ناوبری و بر اساس نقش تصمیم می‌گیرد و کاربر را به `/auth/forbidden` می‌فرستد:
- `!isAuthenticated` → `/auth/login` (رفتار قبلی)
- `isAuthenticated && !hasSalonAccess(role)` → `/auth/forbidden`
- در غیر این صورت مسیر عادی

**نقش‌های مجاز:** `salon_owner`, `line_manager`, `specialist`, `admin` — هم‌تراز با `STAFF_ROLES` در `salon.service.ts` و `APPROVER_ROLES` در `booking.entity.ts`.

**قاعدهٔ fail-closed:** گارد یک allow-list است، نه deny-list. نقش `null`، خالی یا ناشناخته رد می‌شود، چون پنل سالن به امور مالی و مدیریت کارکنان دسترسی دارد و نقشی که اپ نشناخته نباید عبور کند.

**پیامد:** `customer` و نقش‌های ناشناخته به صفحهٔ «شما به این پنل دسترسی ندارید» با دکمهٔ خروج می‌روند. متخصص طبق ADR-003 و چون در `APPROVER_ROLES` است **عمداً مجاز ماند**؛ مسدودکردنش تأیید رزرو را می‌شکست. `/auth/forbidden` جدا از پیشوند `/auth` نگه داشته شد تا حلقهٔ redirect ایجاد نشود.

**تست:** `mobile/salon_app/test/role_guard_test.dart` — ۱۵ تست: چهار نقش مجاز، `customer`، نقش ناشناخته، `null`/خالی، و هر چهار حالت redirect شامل ضدحلقه.

---

## ADR-009: JWT Refresh با rotation و reuse detection (2026-10-05)

**زمینه:** `JWT_REFRESH_SECRET` از ابتدا در env تعریف شده بود ولی **هیچ‌جا مصرف نمی‌شد**. نتیجه دو مشکل: (۱) access token عملاً ابطال‌ناپذیر بود — نشت یک توکن تا ابد معتبر می‌ماند و تغییر نقش کاربر هیچ اثری روی نشست‌های قبلی نداشت؛ (۲) خروج واقعی ممکن نبود و فرانت فقط داده محلی را پاک می‌کرد.

**تصمیم:** توکن کوتاه‌عمر + توکن بلندعمر چرخشی.
- Access: JWT با TTL از `JWT_ACCESS_TTL`؛ Refresh: توکن تصادفی ۳۲ بایتی با TTL از `JWT_REFRESH_TTL` (پیش‌فرض ۳۰ روز)
- **در DB فقط SHA-256 توکن ذخیره می‌شود**، هرگز plaintext
- **rotation اجباری**: هر refresh یک توکن تازه می‌سازد و قبلی را revoke می‌کند
- **reuse detection**: ارائهٔ توکنی که revoke شده یعنی replay یا توکن سرقت‌شده؛ چون سرور نمی‌تواند این دو را تشخیص دهد، کل `family_id` باطل می‌شود و کاربر مجبور به ورود دوباره می‌شود. باطل‌کردن فقط همان توکن، نسخهٔ سرقت‌شده را زنده نگه می‌داشت
- `family_id`: یک خانواده به ازای هر دستگاه/نشست؛ `replaced_by` زنجیره را ثبت می‌کند
- جدول **user-scoped** است نه tenant-scoped (مشتری tenant ندارد — ADR-005)، پس policy روی GUC جدید `app.current_user_id` می‌خواند

**endpoint‌ها:** `POST /auth/refresh` و `POST /auth/logout` عمومی‌اند (دقیقاً چون access token منقضی شده که کلاینت را به اینجا می‌آورد)، و `POST /auth/logout-all` نیازمند guard.

**پیامد:**
- **تغییر breaking در `POST /auth/otp/verify`**: فیلد `token` به `accessToken` تغییر کرد و `refreshToken` و `refreshExpiresAt` اضافه شدند. فرانت باید آپدیت شود.
- `rotate` عمداً **داخل transaction پرتاب نمی‌کند**؛ verdict را برمی‌گرداند و بیرون از تراکنش throw می‌کند، چون throw داخل تراکنش باعث rollback می‌شد و دقیقاً همان revoke خانواده‌ای را که هدف تشخیص reuse است، باطل می‌کرد.
- محدودیت شناخته‌شده: مسیر `/auth/refresh` باید `user_id` را از خود هش توکن پیدا کند، یعنی *قبل* از وجود هر context رRLS. این با نقشی که RLS را دور می‌زند کار می‌کند (همان نقشی که خود اپ با آن وصل می‌شود). انتقال آیندهٔ اپ به نقش NOBYPASSRLS این مسیر را می‌شکند — بهتر است fail loud کند تا دسترسی بی‌سروصدا باز شود.

**تست:** `backend/test/integration/refresh-token.integration-spec.ts` — ۱۰ سناریو روی DB واقعی: هش به‌جای plaintext، rotation با حفظ خانواده و `replaced_by`، reuse detection (کل خانواده باطل می‌شود)، انقضا، توکن ناشناخته، logout تک‌دستگاه، `revokeAll` با شمارش، `revokeFamily`، claimهای access token، و `msDuration`.

---

## ADR-010: Invite Tokens برای salon_owner / line_manager / specialist (2026-10-05)

**زمینه:** در فاز بتا باید مدیر سالن و متخصص بتوانند وارد شوند. مسیر OTP مشتری از
`find_or_create_customer_by_phone` استفاده می‌کند که نقش را **همیشه** `customer` قرار
می‌دهد — این پیش‌فرض درست است و نباید عوض شود، اما نتیجه‌اش این است که هیچ «راه ورود»
برای نیروی کار سالن وجود ندارد: شماره‌ای که از همین مسیر بیاید تا ابد مشتری می‌ماند.
در مقابل، اگر ساخت کاربر با نقش دلخواه را آزاد بگذاریم، هرکسی می‌تواند خودش را «مدیر
سالن» اعلام کند. پس نقش باید از **سمت کسی که صلاحیتش را دارد** تعیین شود، نه از سمت
متقاضی.

**تصمیم:**
- جدول `invite_tokens` با `token_hash` (SHA-256) — دقیقاً همان الگوی `refresh_tokens`
  در ADR-009. توکن خام ۳۲ بایت تصادفی فقط یک‌بار، در همان پاسخِ ساخت دعوت، برمی‌گردد.
- Role در خودِ invite ثبت می‌شود (`invite_role` enum: `salon_owner`، `line_manager`،
  `specialist`)؛ `customer` و `admin` عمداً غایب‌اند — دعوت برای مشتری معنا ندارد و
  اکانت ادمین باید خارج از این جریان ساخته شود.
- انقضای ۷ روز با `INVITE_EXPIRY_DAYS=7` (قابل تنظیم در env).
- **یکبارمصرف**: ستون‌های `used_at` و `used_by`. قفل `FOR UPDATE` روی ردیف هنگام
  پذیرش، بنابراین دو درخواست همزمانِ پذیرش دو اکانت نمی‌سازند.
- **OTP اجباری و متمایز**: پذیرش، شماره را با purpose=invite تأیید می‌کند و کلید Redis
  به `otp:invite:<phone>` تغییر می‌کند تا کدِ ورودِ مشتری برای دعوت قابل استفاده نباشد
  (و بالعکس). کلید rate-limit عمداً **مشترک** می‌ماند تا با عوض‌کردن purpose نتوان از
  سقف ۳ پیامک در ۱۰ دقیقه فرار کرد.
- SMS با لینک حاوی توکن (`KAVENEGAR_INVITE_TEMPLATE`)؛ best-effort است: خطای پیامک
  دعوت را خراب نمی‌کند، چون خودِ پاسخِ ساخت دعوت توکن را دارد.
- **Tenant-scoped با RLS**: `tenant_id` همیشه از JWT می‌آید، **نه از body**. قبول‌کردن
  tenant از درخواست یعنی هر کاربرِ وارد‌شده می‌توانست با یک POST خودش را مدیرِ سالنِ
  دیگری کند.

**پیامدها:**
- چهار endpoint جدید: `POST /auth/invite`، `GET /auth/invite/list`،
  `DELETE /auth/invite/:id`، `POST /auth/invite/accept` (عمومی، چون پذیرنده هنوز
  اکانت ندارد).
- `RolesGuard` به‌عنوان APP_GUARD اضافه شد تا `@Roles()` — که `.cursorrules` همیشه
  ایجاب می‌کرد — واقعاً اجرا شود؛ پیش‌تر چنین گاردی در کد وجود نداشت.
- admin-panel نیاز به صفحهٔ invite دارد: ایجاد/فهرست/لغو + نمایش یک‌بارهٔ توکن.
- SMS قالب جدید: `invite-{role}` (`KAVENEGAR_INVITE_TEMPLATE`).
- پذیرش در صورت وجود کاربرِ قبلی با نقشِ دیگر **۴۰۰** می‌دهد؛ دعوت هرگز نمی‌تواند
  اکانتِ مشتریِ واقعیِ همان شماره را تصاحب کند.
- لغو فقط توسط سازندهٔ دعوت (یا `admin`) ممکن است و پاسخش **404** است نه 403، تا نتوان
  با کاوشِ id فهمید دعوتِ چه کسی پیشِ ماست.
- در فاز ۲: می‌توان به‌جای invite، self-signup + approval اضافه کرد.

**تست:** `backend/test/integration/invite-token.integration-spec.ts` — ساخت دعوت (فقط
hash در DB)، پذیرش با OTP و ساخت کاربر با نقش و tenant درست، `salon_owner`، توکن
منقضی/تکراری/ناشناخته رد می‌شوند، امتناع از تصاحب اکانت customer، فهرستِ فقط pending،
لغو توسط سازنده در برابر غیرسازنده، جداسازی tenant در خواندن و نوشتن، و وجود policy.

**تکمیل جریان onboarding (2026-10-06):** زنجیرهٔ کامل «ساخت سالن → دعوت مدیر → پذیرش»
حالا سرتاسری پیاده و تست شده است:
- **بک‌اند:** `POST /tenants` در `modules/tenant` (فقط `@Roles('admin')`) با DTO
  `CreateTenantDto` (`name`+`slug`)؛ سالن در وضعیت `draft` ساخته می‌شود (ساخت ≠ تأیید؛
  انتشار جداگانه با `PATCH /admin/tenants/:id/status`)، و `slug` تکراری **۴۰۹** می‌دهد.
  انتخاب اولیه `pending_approval` منتفی شد چون ساخت توسط admin باید در صف تأیید بماند.
- **پنل:** صفحهٔ `tenants/create` + `TenantForm` — مرحلهٔ ۱ `POST /tenants`، مرحلهٔ ۲
  `POST /auth/invite` با `role: 'salon_owner'` روی همان `tenantId`؛ توکن یک‌بارمصرف با
  دکمهٔ کپی نمایش داده می‌شود (پس از ساخت، سالن `draft` است و مدیر باید تأیید شود).
- **تست:** `backend/test/integration/tenant-onboarding.integration-spec.ts` — کل مسیر روی
  Postgres واقعی + رد slug تکراری + ایزوله‌بودن سالن تازه به‌عنوان مرز RLS.

**افزودنی (2026-10-06):** دو نکته که در پذیرش invite مشخص شد و رفتار را تثبیت کرد:

- **رکورد `specialists` خودکار ساخته می‌شود.** در `InviteTokenService.accept`، اگر
  `role = 'specialist'`، داخل همان تراکنشِ ساخت کاربر یک ردیف `specialists` هم
  درج می‌شود (`tenant_id` از خود دعوت، `user_id` تازه، `status = 'approved'`,
  `is_active = true`) — دقیقاً همان footprintی که در `SalonService.createSpecialist`
  (`POST /salon/me/specialists`) ساخته می‌شود. دلیل: `bookings.specialist_id` به
  `specialists.id` اشاره می‌کند، پس کاربرِ بدون این ردیف «یتیم» است — می‌تواند وارد
  شود ولی هیچ رزروی نمی‌تواند به او ارجاع بدهد و سالن هرگز او را در فهرست نمی‌بیند.
  `status = 'approved'` انتخاب شد چون دعوت از سمت سالن‌دار حامل تأیید ضمنی است؛
  `bio`/`skills` بعداً توسط سالن‌دار تکمیل می‌شود.
  - تابع `ensureSpecialistRecord` **idempotent** است: دعوت مجدد همان شماره، رکورد
    دوم نمی‌سازد (پذیرشِ کاربرِ موجودِ هم‌نقش هم no-op است).
  - دعوت با نقش `line_manager`/`salon_owner` هیچ ردیف `specialists` نمی‌سازد.
  - نکتهٔ اسکیما: جدول `specialists` ستون `line_id` **ندارد**؛ اتصال متخصص به خط
    خدمات از طریق `services.line_id` انجام می‌شود، نه ستونی روی خود متخصص.
- **`is_active` در برابر `status` تناقض نیست.** `is_active` کلید خاموش‌کنِ اپراتوری
  است (روی `tenants`/`specialists`/`services`/`users` یکسان) و `status` + `approved_at`
  چرخهٔ تأیید/تعلیق است. ویترین عمومی روی
  `approved_at IS NOT NULL AND status <> 'suspended'` **و** `is_active = true` فیلتر
  می‌کند (`PUBLIC_SALON_SQL` در `salon.service.ts`)، پس `status = 'draft'` +
  `is_active = true` در لحظهٔ ساخت، کاملاً درست است. تست پوشش:
  `backend/test/integration/tenant-visibility.integration-spec.ts`.


---

## ADR-011: خدمات سیار — رزرو در محل مشتری (2026-10-10)

**زمینه:** تقاضای فاز ۱ این است که مشتری بتواند درخواست کند متخصص به خانه یا محل کار او
بیاید (آرایشگر/متخصص سیار). هیچ‌کدام از جداول فعلی این قابلیت را نداشتند: نه روی
`specialists` چیزی به معنای «این فرد سیار است» وجود داشت، نه روی `services» چیزی به
معنای «این خدمت بیرون از سالن ارائه می‌شود»، و نه روی `bookings» چیزی به معنای «این
رزرو در محل مشتری است». هر راه‌حلی باید سه خروجی را پوشش دهد: ویترین عمومی فقط سالن‌هایی
که واقعاً می‌توانند سیار بفرستند را نشان دهد، فرم رزرو فقط گزینه‌های واقعاً سیار را
بفرستد، و خودِ رزرو محل و مختصات مشتری را ذخیره کند.

**تصمیم:**

- سه پرچم بولی در یک migration واحد (`1730000000037-MobileService`)، همه با
  `NOT NULL DEFAULT false` تا ردیف‌های موجود بدون تغییری معنادار باقی بمانند:
  `specialists.offers_mobile_service`، `services.is_mobile_available` و
  `bookings.is_mobile`. دو پرچمِ اول مستقل‌اند عمداً: یک فرد سیار بودن **دلالت** بر
  سیار بودنِ هیچ خدمتی ندارد و برعکس.
- روی `bookings`، کنار `is_mobile`: `customer_address TEXT NULL`،
  `customer_latitude`/`customer_longitude NUMERIC(10,7) NULL`، با دو ایندکس جزئی
  (`WHERE is_mobile = true`) روی محل و مختصات — ستون‌ها فقط روی ردیف‌های سیار پر می‌شوند
  و ایندکس کل جدول را بیخود نمی‌پیماید.
- اعتبارسنجی در `BookingService.create` دقیقاً به همین ترتیب: اگر `isMobile` باشد،
  اول آدرس (تنها چیزی که متخصص بدون آن کار نمی‌تواند)، بعد `offersMobileService`، بعد
  `isMobileAvailable`؛ هر کدام برداشته شود، پیام فارسیِ همان مرحله برمی‌گردد. هیچ‌کدام
  از دو پرچم به‌تنهایی کافی نیست — باید هم فرد سیار باشد هم خدمت.
- فیلتر `?mobile=true` روی فید سالن یک **اشتراک** است: `EXISTS` یک متخصص فعالِ سیار **و**
  `EXISTS` یک خدمت فعالِ سیار. هر کدام به‌تنهایی برای مشتری که می‌خواهد در محل رزرو کند
  بی‌فایده است. زیرکوئری‌ها پارامتر ندارند تا `whereSql` با کوئری count هم‌تراز بماند.
- `get_public_salon_specialists()` عمداً بازتعریف **نشده**: migration 0016 شکلِ
  `RETURNS TABLE` آن را ثابت می‌کند و هر فراخوانی به آن وابسته است. در عوض پرچم در یک
  round trip دوم مستقیماً از روی خود `specialists» خوانده می‌شود (آن جدول برخلاف `users`
  RLS ندارد و یک خواندنِ عمومی از آن بی‌خطر است) و در حافظه با فهرستِ تابع merge می‌شود.
  به همین دلیل فیلتر `?mobile` روی `/specialists` در حافظه است نه در SQL.
- endpoint جدید `GET /salons/:id/services` برای picker خدمات (آینهٔ `/specialists`، با
  همان `?mobile`)، و `?mobile` به `GET /salons/:id/specialists` و `GET /salons` اضافه شد.
- پرچم‌ها از پنل سالن آزاد قابل ویرایش‌اند (`offersMobileService` در
  `UpdateSpecialistPanelDto`، `isMobileAvailable` در `UpdateServiceDto`) و نیازی به
  تأیید ادمین ندارند — این‌ها جزئیات عملیاتیِ سالن هستند، نه محتوایی که باید ممیزی
  شود؛ در حد نرخ پورسانت. فهرست‌های پنل هم مقدار فعلیِ هر دو پرچم را برمی‌گردانند.

**پیامدها:**

- `numeric` بودن مختصات یعنی مقدارها به‌صورت **متنِ اعشاری** می‌آیند (مثلاً `35.6892000`)؛
  entityها lat/lng را `string | null` تایپ می‌کنند و INSERT آن‌ها را stringify می‌کند.
  فرانت باید `Number(...)` بزند، نه به رشته اعتماد کند.
- payload جزئیات سالن (`findOne`) حالا `isMobileAvailable` روی هر خدمت و
  `offersMobileService` روی هر متخصص می‌آورد.
- هنوز هیچ منطقی برای **هزینه/زمان سفر** یا تخصیص بر اساس مسافت نیست؛ این پرچم‌ها فقط
  درگاهِ ورودیِ آن هستند. فاز ۲: قیمت سفر، و در نظر گرفتن مسافت در موتور اسلات.
- اگر سالن همهٔ متخصصان سیارش را غیرفعال کند، حتی با داشتنِ خدمتِ سیار از فید `?mobile`
  می‌افتد — این رفتار عمدی است و تست شده است.

**تست:** `backend/test/integration/mobile-service.integration-spec.ts` — ۱۰ سناریو روی
Postgres واقعی از طریق `BookingService` و `SalonService` اصلی (نه بازنویسیِ کوئری):
رد شدن رزرو سیار وقتی متخصص سیار نیست، وقتی خدمت سیار نیست، وقتی آدرس نیست (شامل
فاصله-only)، ثبت کاملِ رزرو سیار با آدرس و مختصات، دست‌نخورده ماندن رزرو عادی (آدرس
حتی اگر فرستاده شود ذخیره نمی‌شود)، فیلتر فید، picker متخصصان، picker خدمات، پرچم‌ها روی
صفحهٔ جزئیات، و اثرگذاری toggleهای پنل روی همهٔ فیلترها.

