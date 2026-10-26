# اصلاح Idempotency مایگریشن + ممیزی ایندکس جداول RLS

**تاریخ:** ۲۰۲۶-۱۰-۲۵ (پایلوت فاز یکسرور / PostgreSQL 16)
**دامنه:** پایداری دیتابیس و اجرای بدون خطای Docker Compose — بدون Gold-plating.
**محیط تست زنده:** `postgres:16-alpine` در Docker با تنظیمات compose (`shared_buffers=1GB`,
`effective_cache_size=2GB`, `max_connections=50`, `random_page_cost=1.1`) و اسکریپت
`docker/postgres/init/01-roles.sql` سوار شده، تا نقش `beauty_app` **قبل از مایگریشن‌ها
وجود داشته باشد** (دقیقاً وضعیت Production/Staging).

---

## ۱. باگ Idempotency نقش `beauty_app` — 🔴 Blocker (اصلاح‌شده)

### علت ریشه‌ای (اثبات‌شده با بازتولید زنده)

فایل `1792850000000-EnableRLSWithBeautyAppRole.ts` دو مشکل پشت‌سرهم داشت. مشکل دوم
تا امروز **پنهان** بود چون مایگریشن هرگز از مرحله نخست عبور نمی‌کرد:

**باگ الف — CREATE ROLE غیر Idempotent + هندلر اشتباه:**

```sql
CREATE ROLE beauty_app NOLOGIN;   -- PostgreSQL از IF NOT EXISTS پشتیبانی نمی‌کند
```

`.catch()` موجود `error.code === '42P10'` را چک می‌کرد، در حالی که PostgreSQL برای
«نقش از قبل وجود دارد» از SQLSTATE **42710** (`duplicate_object` — روتین `CreateRole`)
استفاده می‌کند. پس خطا هرگز catch نمی‌شد.

نکته: این خطا **قطعی** است نه تصادفی — نقش `beauty_app` هم توسط
`docker/postgres/init/01-roles.sql` و هم توسط مایگریشن `1729999999999` (که خود از
بلوک `DO $$ ... IF NOT EXISTS` درست استفاده می‌کند) ساخته می‌شود، پس روی هر استک
Docker قبل از `1792850000000` وجود دارد.

لاگ بازتولید (کد قدیمی، دیتابیس از-پیش-موجود):

```
query failed: CREATE ROLE beauty_app NOLOGIN;
error: role "beauty_app" already exists
Migration "EnableRLSWithBeautyAppRole1792850000000" failed
query: ROLLBACK
QueryFailedError: role "beauty_app" already exists   { code: '42710', routine: 'CreateRole' }
```

**باگ ب — سینتکس نامعتبر GRANT (پنهان):**

پس از رفع الف، اجرا در دستور بعدی شکست خورد:

```
GRANT INSERT ON ALL TABLES IN SCHEMA public (schedule_blocks) TO beauty_app;
error: syntax error at or near "("   { code: '42601' }
```

`GRANT ... ON ALL TABLES IN SCHEMA` نمی‌تواند به جدول خاصی محدود شود. دو خط اضافی
حذف شدند (با `ON ALL TABLES` بالایی کاملاً پوشانده می‌شوند).

### اصلاح اعمال‌شده (دقیقاً طبق دستور)

```ts
await queryRunner.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'beauty_app') THEN
            CREATE ROLE beauty_app NOLOGIN;
        END IF;
    END
    $$;
`);
```

دقیقاً همان الگوی `1729999999999` و `docker/postgres/init/01-roles.sql` (استاندارد
موجود در مخزن). بقیه دستورات `up()` (GRANTها و `ENABLE/FORCE ROW LEVEL SECURITY`)
ذاتاً Idempotent هستند.

### لاگ اجرای موفق روی دیتابیس از-پیش-موجود

```
[migration DataSource] connecting as beauty@localhost:5435/beauty_platform
55 migrations are already loaded in the database.
3 migrations are new migrations must be executed.
Migration EnableRLSWithBeautyAppRole1792850000000 has been executed successfully.
Migration CreateSpecialistServices1792900000000 has been executed successfully.
Migration AddMissingTenantIdIndexes1792950000000 has been executed successfully.
EXIT-CODE: 0
```

این سناریوی واقعی Staging است: دیتابیس با Ledger قبلی (۵۵ مایگریشن، نقش موجود) +
دیپلوی جدید. حالت `migrationsTransactionMode: 'each'` باعث شد شکست قبلی چیزی را
خراب نکند — تنها همان مایگریشن Rollback می‌شد.

`SELECT count(*) FROM migrations` → **۵۸** (همه).

---

## 2. ممیزی ایندکس `tenant_id` جداول RLS - تسک 2

ممیزی کامل زنجیره (15 جدول RLS). معاف‌های موجه: `tenants` (پالیسی روی PK `id`)،
`refresh_tokens`/`support_tickets` (user-scoped)، `ticket_messages` (ستون tenant_id
ندارد؛ tenant از طریق `ticket_id` ایندکس‌شده به والد `tickets` حل می‌شود).

| جدول | ایندکس ستون لیدینگ tenant_id | وضعیت |
|---|---|---|
| bookings | `idx_bookings_tenant_id` | از قبل |
| users | `idx_users_tenant_role` | از قبل |
| tickets | ایندکس tenant | از قبل |
| transactions | `idx_transactions_tenant` | از قبل |
| notifications | `idx_notifications_tenant_id` | از قبل |
| invite_tokens | `idx_invite_tokens_tenant` | از قبل |
| specialists | `idx_specialists_tenant_id` | از قبل |
| services | `idx_services_tenant_id` | از قبل |
| specialist_services | `idx_specialist_services_tenant_active` | از قبل |
| **accounting_ledgers** | -- | **نقص: Seq Scan تضمین‌شده** |
| **schedule_blocks** | فقط ایندکس‌های partial از `1792800000000` | شکاف نسبی |

**اصلاح:** مایگریشن جدید `1792950000000-AddMissingTenantIdIndexes.ts` با
`CREATE INDEX IF NOT EXISTS` (Idempotent) برای هر دو جدول.

### شواهد EXPLAIN زنده (4000 ردیف در 40 tenant)

`accounting_ledgers` - **با ایندکس (جدید):**

```
->  Bitmap Index Scan on idx_accounting_ledgers_tenant_id
    Index Cond: (tenant_id = 'd8708ecb-...'::uuid)
    Buffers: shared hit=4     Execution Time: 0.250 ms
```

**بدون ایندکس (رفتار قبلی):**

```
->  Seq Scan on accounting_ledgers
    Filter: (tenant_id = 'd8708ecb-...'::uuid)
    Rows Removed by Filter: 3900
    Buffers: shared hit=54    Execution Time: 0.380 ms
```

13 برابر فشار buffer بیشتر روی یک جدول 4000 ردیفی - روی داده واقعی تولید، Seq Scan
تمام جدول در هر کوئری پنل.

نکته `schedule_blocks`: این جدول را **ایندکس GiST خود قید تداخل** (`ex_schedule_blocks_no_overlap`)
پوشش می‌دهد (Bitmap Index Scan در هر دو حالت EXPLAIN)، پس ایندکس btree جدید یک
مکمل ایمن برای مسیرهای partial است، نه یک اصلاح بحرانی.

### خودکارسازی ممیزی

`src/database/rls-tenant-indexes.spec.ts` - هر جدول RLS را استاتیک اسکن می‌کند و
assert می‌کند یک `CREATE INDEX ... ON tbl (tenant_id, ...)` وجود دارد. نکته مهم:
این spec در اولین اجرا `ticket_messages` را catch کرد که در ممیز دستی جا افتاده بود
(معافیت موجه آن پس از بررسی مستند شد)؛ و کوری regex برای حلقه پویای `1792048339008`
با pin کردن آن پنج جدول بسته شد تا false-safety باقی نماند.

---

## 3. تایید `EXCLUDE USING gist` + `tstzrange` - تسک 3

آزمایش زنده روی همان دیتابیس:

| تست | نتیجه |
|---|---|
| نوبت 12:00-13:00 ثبت | `INSERT 0 1` |
| همپوشانی 12:30-13:30 همان متخصص | `conflicting key value violates exclusion constraint "no_overlapping_bookings"` |
| پشت‌سرهم 13:00-13:30 (کران `[`) | `INSERT 0 1` - بازه نیمه‌باز درست کار کرد |
| لغو اولی، سپس 12:15-12:45 | `INSERT 0 1` - پالیسی partial اسلات لغوشده را فوراً آزاد کرد |

قید نهایی روی `bookings` (مایگریشن 1792048339001 خودش با `pg_constraint` بررسی
موجودیت قید دارد، پس تکراری ساخته نمی‌شود):

```
EXCLUDE USING gist (specialist_id WITH =, time_slot WITH &&)
  WHERE (status NOT IN ('cancelled', 'no_show'))
```

نیازمند `btree_gist` (در `1730000000000` با `IF NOT EXISTS` ساخته شد) - بدون
خطای مایگریشن. زمان‌ها در DETAIL خطا به UTC نرمالایز شده‌اند (+03:30) که نشان
می‌دهد `tstzrange` با timezone به‌درستی مقایسه می‌کند. `schedule_blocks` نیز هر دو
قید `ex_schedule_blocks_no_overlap` و `ex_schedule_blocks_whole_salon` (partial
برای blockهای کل سالن) را دارد.

---

## 4. وضعیت تست‌ها

- `npm run build` OK
- Jest: **114/114 تست در 16 suite** (10 تست جدید: ممیزی RLS). زمان: ~29s.
- N+1: `QueryLimitInterceptor` (`MAX_QUERIES = 5`) در `AppModule` ثبت شده و
  کوئری‌ها را شمارش/هشدار می‌دهد. اندپوینت‌های کاتالوگ عمومی 1-2 کوئری هستند.
- **هیچ `&` و پس‌زمینه‌ای استفاده نشد**: همه دستورات foreground در PowerShell/Docker.

## 5. بررسی Docker Compose (تحویل به دستیار دوآپس)

- `docker-compose.yml` (dev): PostgreSQL `shared_buffers=1GB`,
  `effective_cache_size=2GB` OK - Redis `maxmemory 256mb allkeys-lru` OK
- `docker-compose.production.yml`: همان تنظیمات + `mem_limit` OK
- `docker-compose.staging.yml`: **PostgreSQL تنظیمات `-c` را نداشت** (پیش‌فرض
  128MB) در حالی که Redis درست تنظیم شده بود. **اصلاح شد** - خط `command` مشابه
  dev/production با کامنت دلیل اضافه شد.

## 6. الزامات گزارش‌دهی

- **Blocker:** Idempotency نقش (SQLSTATE اشتباه 42710 vs 42P10) + GRANT نامعتبر
  (42601) - هر دو اصلاح و به‌صورت زنده تایید شد.
- **Suggestion:** ایندکس `accounting_ledgers` مفقود بود (Seq Scan واقعی)؛
  `schedule_blocks` فقط ایندکس partial داشت - مایگریشن `1792950000000` اضافه شد.
- **Nit:** `migration-names.spec.ts` به دلیل انطباق رشته‌ای `rolname = '...'`
  در SQL، وجود پراپرتی `name` را واقعاً اجبار نمی‌کند (نام کلاس ثابت است، ریسک
  پایین) - اصلاح خارج از محدوده این تسک.

## چک‌لیست PM

- [x] اصلاحیه مایگریشن دقیقاً با بلوک `DO $$` اعمال شد (اضافه: رفع GRANT نامعتبر که
      بعد از آن آشکار شد).
- [x] دیتابیس بدون drop با موفقیت بالا آمد؛ جداول RLS ایندکس‌های درستی دارند
      (58/58 مایگریشن؛ EXPLAIN قبل/بعد ضمیمه).
- [x] هیچ فرآیندی با `&` در پس‌زمینه سرور اجرا نشد (همه foreground).
- [ ] اپلیکیشن مشتری صفحه خطای 500 - **مسئول دستیار UI/UX**، خارج از محدوده این
      تسک (طبق قانون عدم Gold-plating، فقط پایداری DB/Compose در این اسپرینت).

## فایل‌های تغییر‌یافته

- `backend/src/database/migrations/1792850000000-EnableRLSWithBeautyAppRole.ts` (اصلاح اصلی)
- `backend/src/database/migrations/1792950000000-AddMissingTenantIdIndexes.ts` (جدید)
- `backend/src/database/rls-tenant-indexes.spec.ts` (جدید)
- `docker-compose.staging.yml` (تنظیمات PostgreSQL)
