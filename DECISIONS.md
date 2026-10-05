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
