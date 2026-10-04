# ۰۲ — پایگاه‌داده، مهاجرت‌ها و RLS (چندمستأجری)

> اولویت: **بالا** — این بخش ستون فقرات امنیت و صحت داده در پلتفرم است.
> مسیر مهاجرت‌ها: `e:\BOYA platform\backend\src\database\migrations\`
> منبع runtime: `e:\BOYA platform\backend\src\database\data-source.ts` (`synchronize: false` — هیچ‌گاه schema از entity ساخته نمی‌شود)

---

## ۲.۱ فهرست کامل مهاجرت‌ها (۲۷ فایل)

| # | فایل | نقش |
| --- | --- | --- |
| 0 | `1730000000000-CreateBookings` | هسته: `tenants`, `users`, `specialists`, `services`, `bookings` + `btree_gist` + Exclusion Constraint + RLS |
| 1 | `1730000000001-PerformanceIndexes` | ایندکس‌های کارایی + autovacuum |
| 2 | `1730000000002-TenantUserProfile` | پروفایل tenant/user + `pgcrypto` + یکتایی `phone` + RLS روی `users` |
| 3 | `1730000000003-ServiceLines` | `service_lines` + ستون‌های services |
| 4 | `1730000000004-Transactions` | دفتر تراکنش + `processed_webhook_events` |
| 5 | `1730000000005-Notifications` | اعلان درون‌برنامه‌ای |
| 6 | `1730000000006-Referrals` | `referrals` + `loyalty_points` (**بدون RLS** — عمداً) |
| 7 | `1730000000007-MakeUserTenantNullable` | `users.tenant_id` اختیاری |
| 8 | `1730000000008-CustomerLookupFunction` | `find_or_create_customer_by_phone()` (SECURITY DEFINER) |
| 9 | `1730000000009-AddSalonFieldsAndCategories` | فیلد سالن + دسته‌بندی + seed |
| 10 | `1730000000010-AddCategoryEmoji` | ستون emoji دسته‌بندی |
| 11 | `1730000000011-AddBookingReviewedStatus` | وضعیت `reviewed` + `no_show_count` + `reviews` |
| 12 | `1730000000012-AlignServiceAndSpecialistSchema` | هم‌ترازی `commission_rate`, `skills`, `bio` |
| 13 | `1730000000013-LookupFunctionReturnsTenantId` | افزودن `tenant_id` به خروجی lookup |
| 14 | `1730000000014-CustomerBookingsLookup` | `get_customer_bookings()` |
| 15 | `1730000000015-PublicSalonSpecialistsLookup` | ویترین عمومی متخصص‌ها |
| 16 | `1730000000016-PublicSalonPortfolioLookup` | ویترین نمونه‌کار |
| 17 | `1730000000017-SeedSpecialistPortfolioImages` | seed نمونه‌کار |
| 18 | `1730000000018-ApprovalSchema` | نوع `approval_status` + ستون‌های تأیید |
| 19 | `1730000000019-SeedExistingAsApproved` | رکوردها → `approved` |
| 20 | `1730000000020-AdminApprovalAccess` | توابع ادمین صف تأیید خطوط خدمت |
| 21 | `1730000000021-PanelBookingsLookup` | lookup رزروهای پنل سالن |
| 22 | `1730000000022-AdminDashboard` | توابع داشبورد ادمین |
| 23 | `1730000000023-AdminTenants` | توابع مدیریت tenant در پنل ادمین |
| 24 | `1730000000024-AdminUsers` | توابع مدیریت کاربران |
| 25 | `1730000000025-DeviceTokens` | توکن‌های FCM (**بدون RLS**) |
| 26 | `1730000000026-UnifyTenantGuc` | **no-op عمدی** |
| 27 | `1730000000027-UnifyTenantGuc` | **تنها محل سیاست‌های tenant** (ADR-001) |

---

## ۲.۲ قید Exclusion — جلوگیری از همپوشانی رزرو

در مهاجرت `1730000000000`:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    specialist_id WITH =,
    time_slot WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'))
```

نکات کلیدی:

- `time_slot` از نوع `TSTZRANGE` **نیمه‌باز** `[start, end)` — دو نوبت ۱۲:۰۰–۱۲:۳۰ و ۱۲:۳۰–۱۳:۰۰ همپوشانی ندارند.
- **قید جزئی**: `cancelled` و `no_show` استثنا شده‌اند، پس لغو یک نوبت اسلات را فوراً آزاد می‌کند. `reviewed` استثنا نیست (همانند `completed` اسلات را اشغال نگه می‌دارد — درست برای تاریخچه).
- نیازمند `btree_gist` (برای ترکیب `=` روی uuid با `&&` روی range).
- خطای نقض کد **`23P01`** دارد:

```ts
function isOverlap(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23P01';
}
```

> **نکته مشاور:** *تنها* محافظ در برابر رزرو دوگانه، همین Exclusion است. هیچ قفل اپلیکیشنی (advisory lock، `SELECT FOR UPDATE`) وجود ندارد. این طراحی ساده و ایمن است **به شرطی** که `23P01` در لایه سرویس به پاسخ دامنه‌ای ترجمه شود — بررسی کامل در بخش ۰۳ و به‌عنوان ریسک در بخش ۰۵.

---

## ۲.۳ وضعیت RLS روی جداول

| جدول | ENABLE RLS | FORCE RLS | سیاست | ستون |
| --- | --- | --- | --- | --- |
| `bookings` | ✅ | ✅ | `bookings_tenant_isolation` | `tenant_id` |
| `users` | ✅ | ✅ | `users_tenant_isolation` | `tenant_id` (nullable) |
| `service_lines` | ✅ | ✅ | `service_lines_tenant_isolation` | `tenant_id` |
| `transactions` | ✅ | ✅ | `transactions_tenant_isolation` | `tenant_id` |
| `notifications` | ✅ | ✅ | `notifications_tenant_isolation` | `tenant_id` |
| `tenants` | ❌ | ❌ | — | کنترل اپلیکیشن |
| `specialists`, `services` | ❌ | ❌ | — | کنترل سرویس |
| `reviews` | ❌ | ❌ | — | کنترل سرویس |
| `referrals`, `loyalty_points` | ❌ | ❌ | — | کاربرمحور، نه tenant‌محور |
| `device_tokens` | ❌ | ❌ | — | `user_id` از JWT |
| `processed_webhook_events` | ❌ | ❌ | — | سراسری (idempotency) |

> `FORCE ROW LEVEL SECURITY` تضمین می‌کند مالک جدول (نقش migration) هم مشمول RLS باشد. بدون `FORCE`، همان نقش همه ردیف‌ها را می‌دید و تفکیک tenant در سطح دیتابیس بی‌اثر می‌شد.

---

## ۲.۴ بحران دو GUC مختلف — و رفع آن در مهاجرت ۲۷

این **مهم‌ترین هشدار امنیتی** کل پروژه است.

مهاجرت‌های اولیه همه از یک GUC استفاده کرده‌اند:

| مهاجرت | GUC در سیاست |
| --- | --- |
| `0000-CreateBookings` | `app.tenant_id` |
| `0002-TenantUserProfile` | `app.tenant_id` |
| `0003-ServiceLines` | `app.tenant_id` |
| `0004-Transactions` | `app.tenant_id` |
| `0005-Notifications` | `app.tenant_id` |

اما کد runtime فقط GUC دیگری را تنظیم می‌کند:

```ts
// backend\src\database\tenant-context.ts
export async function setTenantContext(qr, tenantId): Promise<void> {
  await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
}
```

پیامد پیش از مهاجرت ۲۷:
- `current_setting('app.tenant_id', true)` مقدار `''` می‌دهد
- `NULLIF('', '')::uuid` → `NULL`
- `tenant_id = NULL` هیچ‌وقت درست نیست → سیاست **به‌صورت ساکت صفر ردیف** برمی‌گرداند (نه خطا). این بدترین حالت ممکن است: یک باگ امنیتی که به‌جای خطا، نتیجه «خالی» می‌دهد.

**رفع نهایی در مهاجرت ۲۷** (`UnifyTenantGuc1730000000027`): تنها محل تعریف سیاست‌های tenant. برای هر پنج جدول، سیاست را `DROP` و دوباره روی `app.current_tenant_id` می‌سازد:

```sql
CREATE POLICY <table>_tenant_isolation ON <table>
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```

مهاجرت ۲۶ عمداً **no-op** است (فقط برای سازگاری با `migrations` table دیتابیس‌های قدیمی نگه داشته شده). مهاجرت ۲۷ **غیرقابل بازگشت** است: `down()` خالی است، چون بازگرداندن GUC قدیمی همه جداول tenant‌محور را صفر می‌کند.

> **سؤال باز برای مشاور:** آیا در محیط‌های موجود (staging/prod) مهاجرت ۲۷ اجرا شده است؟ اگر دیتابیسی وجود دارد که پس از مهاجرت ۲۶ ولی پیش از ۲۷ بوت شده، ممکن است داده‌های tenant‌محور در گزارش‌ها «گم‌شده» به‌نظر برسند بدون هیچ خطای صریح.

---

## ۲.۵ الگوی «خروج امن» — توابع `SECURITY DEFINER`

RLS برای همه چیز کافی نیست: چند مسیر مشروع وجود دارد که به‌صورت عمدی **در سراسر tenant** کار می‌کنند. الگوی پروژه این است که این کار درون توابع SQL با `SECURITY DEFINER` انجام شود؛ توابعی که مالکشان نقش migration است، از RLS معاف‌اند، فقط به `beauty_app` GRANT شده‌اند و از `PUBLIC` پس گرفته شده‌اند.

فهرست کامل این توابع:

| تابع | مهاجرت | کار |
| --- | --- | --- |
| `find_or_create_customer_by_phone(VARCHAR)` | `0008` → `0013` | ورود OTP: پیدا/ساخت مشتری و برگرداندن `tenant_id` |
| `get_public_salon_tags(...)` | `0009` | ویترین عمومی برچسب سالن‌ها |
| `get_customer_bookings(UUID)` | `0014` | لیست نوبت‌های خود مشتری (مشتری `tenant_id` ندارد) |
| `get_public_salon_specialists(...)` | `0015` | ویترین عمومی متخصص‌ها |
| `get_public_salon_portfolio(...)` | `0016` | ویترین نمونه‌کار |
| `admin_list_service_line_approvals(approval_status)` | `0020` | صف تأیید (قدیمی‌ترین اول) |
| `admin_get_service_line_approval(UUID)` | `0020` | خواندن تکی برای `GET /admin/approvals/:type/:id` |
| `admin_apply_service_line_approval(...)` | `0020` | تنها راه نوشتن؛ `approved_by` خودش زده می‌شود |
| `admin_dashboard_counts()` | `0022` | شمارش‌های هدر داشبورد |
| `admin_dashboard_weekly()` | `0022` | رزروهای ۷ روز اخیر به وقت تهران |
| توابع `AdminTenants` | `0023` | مدیریت tenant |
| توابع `AdminUsers` | `0024` | مدیریت کاربران |
| توابع `PanelBookingsLookup` | `0021` | رزروهای پنل سالن |

دو نکته معماری مهم که در کامنت‌های مهاجرت‌ها مستند شده‌اند:

1. **`admin_apply_service_line_approval` تنها راه نوشتن است:** وضعیت هدف را پارامتر می‌گیرد و `approved_at`/`approved_by` را خودش می‌زند — پس قابل جعل نیست. در رد کردن، تأییدیه قبلی پاک نمی‌شود («رد این درخواست، پس‌گرفتن تأییدیه قبلی نیست»).
2. **منطق روزها در `Asia/Tehran`** حل می‌شود، نه timezone دیتابیس، تا «امروز» و سری ۷ روزه با پنل یکی باشد.

---

## ۲.۶ جزئیات دو مهاجرت کلیدی

### `1730000000018-ApprovalSchema` (ساختار تأییدیه)

نوع جدید و ستون‌های تأیید روی سه جدول:

```sql
CREATE TYPE approval_status AS ENUM
  ('draft', 'pending_approval', 'approved', 'rejected', 'suspended');

ALTER TABLE tenants
  ADD COLUMN status approval_status NOT NULL DEFAULT 'draft',
  ADD COLUMN rejection_reason TEXT NULL,
  ADD COLUMN approved_at TIMESTAMPTZ NULL,
  ADD COLUMN approved_by UUID NULL REFERENCES users(id),
  ADD COLUMN pending_changes JSONB NULL;   -- فقط روی tenants
```

`service_lines` و `specialists` نیز `status`, `rejection_reason`, `approved_at`, `approved_by` می‌گیرند (بدون `pending_changes`). سه ایندکس `idx_*_status` برای فیلتر صف ساخته می‌شود.

> **نکته:** ستون `pending_changes JSONB` **فقط روی `tenants`** است. سالن می‌تواند ویرایشی پیشنهاد دهد و تا تأیید ادمین، تغییر در انتظار بماند. تأیید `service_lines` و `specialists` صرفاً «فلیپ وضعیت» است (در کامنت مهاجرت ۲۰ صریح شده).

### `1730000000025-DeviceTokens` (توکن‌های FCM)

```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **بدون RLS، عمداً:** مشتری به هیچ tenant تعلق ندارد و اعلان باید در همه سالن‌ها خوانده شود؛ ستون tenant توکن‌ها را دقیقاً از درخواست‌هایی که به آن‌ها نیاز دارند پنهان می‌کرد.
- `token` UNIQUE است چون FCM توکن را هنگام نصب مجدد/رفرش سیستم می‌چرخاند؛ ثبت دوباره باید upsert باشد نه insert تکراری.
- ردیف‌ها با `user_id` **تأییدشده از JWT** کلید می‌خورند، نه مقدار درخواست (همان معامله `audit_logs`).

### `1730000000006-Referrals` — آگاهانه بدون RLS

`referrals` و `loyalty_points` tenant‌محور نیستند: یک معرفی دو کاربر را به هم وصل می‌کند و امتیاز کاربر را در سراسر سالن‌ها دنبال می‌کند. یک ایندکس یکتای جزئی برای idempotent کردن sweep انقضا:

```sql
CREATE UNIQUE INDEX uq_loyalty_points_expiry_once
  ON loyalty_points(source_id, type) WHERE type = 'expired';
```

> **گپ امنیتی:** دسترسی به `referrals`/`loyalty_points` **صرفاً** در لایه اپلیکیشن محدود شده و هیچ سیاست دیتابیسی ندارد. اگر یک مسیر API جدید اشتباهاً فیلتر کاربر را جا بیندازد، هیچ تور دومی وجود ندارد. برای فاز دوم، RLS کاربرمحور (`user_id = current_setting('app.current_user_id')`) توصیه می‌شود.

---

## ۲.۷ نقش‌های دیتابیس

`docker\postgres\init\01-roles.sql` (فقط در نخستین اجرای کانتینر):

```sql
CREATE ROLE beauty_app WITH LOGIN PASSWORD 'app_password_dev';
ALTER ROLE beauty_app NOBYPASSRLS NOSUPERUSER;   -- حیاتی
GRANT CONNECT ON DATABASE beauty_platform TO beauty_app;
GRANT USAGE ON SCHEMA public TO beauty_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beauty_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beauty_app;
```

نکات:

- **`NOBYPASSRLS`** تضمین می‌کند نقش اپلیکیشن واقعاً subject به سیاست‌ها باشد.
- نقش migration (`DATABASE_MIGRATION_USER`) نقش **دیگری** است که مالک جداول و توابع `SECURITY DEFINER` است. جداسازی این دو نقش همان چیزی است که الگوی «خروج امن» را ممکن می‌کند.
- **رمز پیش‌فرض `app_password_dev` در کد commit شده** است؛ باید در محیط واقعی با سکرت بازنویسی شود.
- در `1730000000006` صراحتاً اشاره شده: «نقش `boya_app` در این محیط وجود ندارد» و هیچ GRANTی صادر نشده. در سایر مهاجرت‌ها نام `beauty_app` آمده. **ناهم‌راستایی نام نقش باید بررسی شود** — اگر GRANTها روی نقشی صادر شوند که ساخته نمی‌شود، توابع `SECURITY DEFINER` برای اپلیکیشن قابل اجرا نخواهند بود.

---

## ۲.۸ جدول‌بندی Entityهای TypeORM

مهم‌ترین entityها و روابطشان (از فایل‌های `*.entity.ts` در `backend\src\modules\`):

- **`Booking`** (`booking.entity.ts`): `tenantId`, `specialistId`, `customerId`, `serviceId`, `timeSlot` (tstzrange با transformer نیمه‌باز)، `status` (6 حالت)، `totalPrice`, `depositPaid`, `flexibleSpecialist`, `notes`, `bookingReminderSentAt`, `feedbackReminderSentAt`, `visitConfirmedByCustomerAt`. `APPROVER_ROLES = ['salon_owner', 'line_manager', 'specialist']`.
- **`User`** (`user.entity.ts`): `tenantId` (nullable در دیتابیس — توجه: entity آن را non-null نشان می‌دهد)، `phone`, `fullName`, `avatarUrl`, `role`, `isActive`, `noShowCount`.
- **`Transaction`**: `tenantId`, `bookingId` (UNIQUE)، `provider`, `providerIntentId`, `status`, `totalAmount`, `platformFee`, `specialistShare`, `salonShare`, `refundAmount`, `providerRefundId`, `metadata`, `capturedAt`, `refundedAt`. مقادیر `DECIMAL(12,0)` — **ریال صحیح**.
- **`Specialist`**: `tenantId`, `userId`, `bio`, `skills` (JSONB)، `commissionRate` (decimal پیش‌فرض 50)، `isActive`, `status`.

**نکته مهم درباره روابط:** روابط TypeORM (`@ManyToOne`, `@JoinColumn`) در entityها تعریف **نشده‌اند**؛ به‌جای آن ستون‌های FK خام وجود دارند و JOINها در کوئری‌های SQL/`queryBuilder` سرویس‌ها نوشته شده‌اند. این یعنی `save()` خودکار رکورد وابسته را نمی‌سازد و همه چیز باید صریح مدیریت شود. مزیتش این است که سیاست RLS و توابع SQL کاملاً در کنترل‌اند؛ عیبش این است که بار شناختی schema را روی سرویس‌ها می‌گذارد.

---

## ۲.۹ خلاصه شکاف‌ها و ریسک‌های پایگاه‌داده

| مورد | وضعیت | شرح | اولویت |
| --- | --- | --- | --- |
| عادی‌سازی GUC | ✅ حل‌شده در مهاجرت ۲۷ | سیاست‌ها روی `app.current_tenant_id` | — |
| مهاجرت ۲۷ در محیط‌های موجود؟ | ⚠️ بررسی | اگر اجرا نشده، داده tenant‌محور «ساکت صفر» | **بالا** |
| مدیریت `23P01` | ⚠️ بررسی | ترجمه Exclusion به پاسخ دامنه‌ای در سرویس | **بالا** |
| نام نقش `boya_app` vs `beauty_app` | ❌ ناهم‌راستا | GRANT روی نقشی که ساخته نمی‌شود → توابع ادمین بی‌کار | **بالا** |
| رمز dev در کد | ⚠️ | `app_password_dev` در init SQL | متوسط |
| RLS کاربرمحور برای referrals/loyalty | ❌ وجود ندارد | کنترل صرفاً اپلیکیشنی | متوسط |
| روابط TypeORM خام | ℹ️ طراحی عمدی | JOINها در سرویس‌ها | — |
| یکتایی سراسری `users.phone` | ⚠️ | آیا یک شماره می‌تواند هم مشتری باشد هم کارمند؟ | پرسش مشاور |
| تست integration برای RLS/Exclusion | ❌ وجود ندارد | هیچ تست واقعی با Postgres برای RLS/Exclusion نیست | **بالا** |
| `processed_webhook_events` بدون RLS | ✅ عمدی | سراسری برای idempotency | — |



