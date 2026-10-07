# BACKLOG

## Lint Issues

**وضعیت: خالی — `npm run lint` با ۰ error و ۰ warning پاس می‌شود.**

eslint 8.57.1 + `@typescript-eslint` 8.71.0 نصب و پیکربندی شده
(`backend/.eslintrc.js`) و step مربوط به lint در CI دیگر `continue-on-error`
ندارد، یعنی **lint واقعاً build را می‌شکند اگر regress کند**.

### موارد رفع‌شده (۶ مورد، ۰ مورد deferred)
- [x] `src/modules/auth/auth.service.ts` — ایمپورت بی‌استفادهٔ `InjectRepository` حذف شد
- [x] `src/modules/notification/services/reminder.scheduler.ts` — ایپورت بی‌استفادهٔ `BookingStatus` حذف شد
- [x] `src/modules/admin/audit-logs/admin-audit-logs.service.ts` — `TARGET_TYPES` هیچ استفادهٔ runtime نداشت؛ به union type مستقیم تبدیل شد (`export type AuditTargetType = 'tenant' | 'user' | 'booking'`)
- [x] `test/setup/pg-client.ts` — کامنت disable به rule درست اصلاح شد؛ کامنت قبلی `no-var-requires` را خاموش می‌کرد در حالی که rule فعال `no-require-imports` است
- [x] `test/setup/test-db.ts` — همان اصلاح برای `require('ts-node').register(...)`
- [x] `src/database/migrations/1730000000007-MakeUserTenantNullable.ts` — **عمداً ویرایش نشد**. `.cursorrules` می‌گوید migration قدیمی هرگز ویرایش نشود؛ به‌جایش در `.eslintrc.js` یک `overrides` برای `src/database/migrations/**` اضافه شد که `no-unused-vars` را خاموش می‌کند

هر دو `require()` عمدی هستند: `pg` بدون type نصب می‌شود (`@types/pg` وجود ندارد و
هدر `pg-client.ts` این را توضیح می‌دهد)، پس `require` + type assertion تنها راه
بدون `noImplicitAny` است.

## حل‌شده: lockfile خراب (historical)

این مورد دیگر blocker نیست و صرفاً برای سابقه ثبت شده.

`npm ci` قبلاً با خطای زیر می‌شکست:

```
npm error TypeError: Invalid Version:
npm error   at Node.canDedupe (.../@npmcli/arborist/lib/node.js:1140:32)
```

**علت ریشه‌ای:** در `backend/package-lock.json` ۲۷ ورودی `version` نداشتند — همه
اختیاری و platform-specific:
`node_modules/jest-haste-map/node_modules/fsevents`،
`@msgpackr-extract/msgpackr-extract-*` (۴) و `@unrs/resolver-binding-*` (۲۱).
`canDedupe` روی `undefined` صدای `semver.compare` را می‌زند و می‌ترکد.

**رفع:** آن ۲۷ ورودی حذف شدند (commit `d564101`). diff خالص حذف بود: ۱۰۳ خط
حذف، صفر خط اضافه — یعنی هیچ `resolved`/`integrity` بازنویسی نشد و CI به
registry چین وابسته نیست. `npm ci` و هر سه suite سبز شدند.

## Phase 2: Product (در حال شروع)

زیرساخت پاک و سبز است (lint صفر خطا، هر سه suite بک‌اند سبز، CI با
postgres/redis واقعی). اینها تصمیم‌های باز قبل از نوشتن کد فاز محصول‌اند.

### شکاف امنیتی/محصولی که باید اول بسته شود
- [x] ~~**route guard نقش در `salon_app`**~~ — **بسته شد 2026-10-05** (ADR-008).
      `hasSalonAccess` به‌صورت allow-list هم‌تراز با `STAFF_ROLES` بک‌اند اضافه شد،
      `redirect` در `app_router.dart` نقش را می‌خواند، صفحهٔ `/auth/forbidden` با
      دکمهٔ خروج ساخته شد و ۱۵ تست در `test/role_guard_test.dart` اضافه شد.

### تصمیم‌های باز محصول
- [ ] ورود مدیر سالن: دعوتنامه با SMS؟ یا admin-panel؟
- [ ] ورود متخصص: توسط مدیر دعوت میشود یا خودش؟
- [x] ~~JWT refresh: rotation + revocation strategy؟~~ — **بسته شد 2026-10-05** (ADR-009).
      refresh با rotation و reuse detection پیاده شد؛ `POST /auth/otp/verify`
      حالا `accessToken` + `refreshToken` برمی‌گرداند.
- [x] ~~**⚠️ فرانت را با تغییر breaking هماهنگ کن.**~~ — **بسته شد 2026-10-05.**
      هر سه کلاینت `POST /auth/otp/verify` را با `accessToken` + `refreshToken` +
      `refreshExpiresAt` مصرف می‌کنند و `/auth/refresh` روی ۴۰۱ صدا می‌زنند:
      - `mobile/salon_app` (commit `88228b3`) — secure storage + interceptor با single-flight
      - `mobile/customer_app` (commit `0116b5f`) — همان الگو، با حفظ ساختار flat خودش
      - `admin-panel` (commit `773f407`) — axios interceptor + `useSignOut`
- [x] ~~`flutter_secure_storage` جای `SharedPreferences`~~ — **بسته شد 2026-10-05** در
      هر دو اپ موبایل (`^11.2.0`، هم‌تراز با `boya_shared`). مهاجرت از کلید قدیمی
      انجام و نسخهٔ plaintext پاک می‌شود. `admin-panel` استثناست — مرورگر
      keystore ندارد؛ به بخش A فاز ۲ نگاه کن.

### کارهای باقی‌مانده از فاز زیرساخت
- [x] ~~`fl_chart` در `salon_app` اعلام نشده بود~~ — **بسته شد 2026-10-05**
      (`^1.2.0` اضافه شد، هم‌تراز با `boya_shared` تا یک نسخه resolve شود؛
      `flutter analyze` در هر سه پکیج پاک است).
- [x] ~~**`pubspec.lock` برای اپ‌ها commit نمی‌شود**~~ — **بسته شد 2026-10-05**
      (commit `cceb453`). خط سراسری `pubspec.lock` در `.gitignore` با
      `/mobile/shared/pubspec.lock` جایگزین شد: فقط lockfile پکیج کتابخانه‌ای
      ignore می‌شود و lockfile هر دو اپ track می‌شود تا build قابل بازتولید باشد.

## Phase 2 — Security (تأخیر عمدی)

موارد زیر **عمداً به فاز ۲ موکول شده‌اند**، نه از سر فراموشی: هر کدام یا
ریسک‌شان فقط با کاربر واقعی معنا پیدا می‌کند، یا بازده کمی دارند.

### A. refresh token در localStorage (admin-panel)
- **ریسک:** XSS → دزدیدن refresh token
- **راه‌حل:** httpOnly cookie برای refresh
- **نیاز:** تغییر بک‌اند (Set-Cookie در verifyOtp) + CORS با credentials
- **اولویت:** بعد از اولین کاربران واقعی

> دو اپ موبایل refresh token را در keystore گذاشتند، ولی مرورگر چنین
> چیزی ندارد. localStorage بهترین گزینهٔ موجود است، اما یک عقب‌نشینی
> امنیتی آگاهانه نسبت به موبایل است، نه یک انتخاب بی‌فرق.

### B. تست admin-panel
- **وضعیت:** هیچ setup تستی ندارد (نه jest، نه vitest)
- **حداقل:** یک تست single-flight برای refresh interceptor
- **اولویت:** کم — admin-panel فقط internal است
- **نکته:** `tsc --noEmit` و `next build` هر دو پاس می‌شوند، ولی منطق
  single-flight و retry همان چیزی است که در دو اپ دیگر تست شد و اینجا
  **بدون پوشش تستی** ریسک است.

### C. web/specialist/ حذف
- **وضعیت:** پوشه‌ای که به یک اپ جداگانه اشاره می‌کند که دیگر وجود ندارد
  (`mobile/specialist_app` طبق ADR-003 حذف شد)
- **اولویت:** کم — فقط cleanup
- **توجه:** جدول `web/README.md` اصلاح شده و به `salon_app` اشاره می‌کند؛ خودِ
  پوشه هنوز سر جایش است.

## Staging / Deploy (docker-compose.staging.yml)

استک staging برای تست SMS/OTP بالا آمد و smoke test شد (جزئیات در `docs/report/STATE.md`
بخش Deploy). این موارد production-blocker هستند و قبل از تحویل واقعی باید بسته شوند:

- [ ] **DB password در staging از env بیاید (نه hardcoded)** — الان در
      `docker-compose.staging.yml` مقدار `change-me` به‌صورت ثابت در چهار جا نوشته
      شده: `POSTGRES_PASSWORD` (postgres)، `DATABASE_MIGRATION_PASSWORD`
      (backend-migrate)، `DATABASE_PASSWORD` و `DATABASE_MIGRATION_PASSWORD`
      (backend). باید `${POSTGRES_PASSWORD:?set in .env}` را از `.env` بخوانند تا
      رمز واقعی هیچ‌وقت در repo نباشد.
- [ ] **migration با `beauty_app` (نه master)** — الان `backend-migrate` با کاربر
      `beauty` (master) اجرا می‌شود چون `data-source.migration.ts` به‌عنوان
      `beauty_app` راه‌اندازی را رد می‌کند. نتیجه: جداول با owner=master زده
      می‌شوند و مالکیت/GRANTهای RLS درست نمی‌نشینند. باید یا data-source را اصلاح
      کرد یا حداقل پس از migration `ALTER TABLE ... OWNER TO beauty_app` زد.
- [ ] **دامنه واقعی + HTTPS در Caddy** — الان `Caddyfile` روی `:80` سرو می‌کند
      (بدون auto-HTTPS). باید `staging.boya.ir { encode zstd gzip; reverse_proxy
      backend:3000 }` جایگزین شود تا Caddy به‌صورت خودکار گواهی Let's Encrypt
      بگیرد؛ `INVITE_BASE_URL` هم باید به همان دامنه-set شود.

## Testing — SMS (Kavenegar)

مسیر دعوتنامه کامل پیاده شده (`invite-token.service.ts`: `create` ردیف را در
`invite_tokens` ذخیره می‌کند و `sendInviteSms` را صدا می‌زند، `accept` با
`SELECT ... FOR UPDATE` روی hash آن را خرج می‌کند)، ولی هنوز **هیچ SMS واقعی
ارسال نشده**. `INVITE_BASE_URL` و قالب‌ها در `.env.example` اضافه شدند و
`env.validation.ts` آن‌ها را optional گرفت، تا وقتی مقدار ندارند send سایلنت
skip شود. این موارد دستی پیش از تحویل به یک شماره واقعی باید انجام شوند:

- [ ] **کلید production در Kavenegar ساخته و نصب شود** — `KAVENEGAR_API_KEY` واقعی در
      **`.env` ریشهٔ پروژه** (که `docker-compose.staging.yml` آن را می‌خواند، نه
      `backend/.env`) تنظیم شود (`change-me` فعلی فقط sandbox است).
- [ ] **قالب `invite` در پنل Kavenegar ساخته شود** — نام آن در
      `KAVENEGAR_INVITE_TEMPLATE` می‌رود. این تنها قالب لازم است؛ همهٔ نقش‌ها
      به آن fallback می‌کنند.
      > **نکته مهم:** قالب باید **دقیقاً یک** متغیر داشته باشد که با سینتکس کاوه‌نگار
      > به‌صورت `%token` نوشته شود. `sendInviteSms` فقط `tokens: { token: link }` را
      > می‌فرستد و درایور آن را به پارامتر `token` از `verify/lookup.json` نگاشت می‌کند،
      > پس قالب دو-متغیره کار نمی‌کند. متن پیشنهادی:
      > `دعوت به پلتفرم بویا صادر شد. برای پذیرش کلیک کنید: %token`
- [ ] **قالب `invite-owner` ساخته شود** — `KAVENEGAR_INVITE_OWNER_TEMPLATE`.
      قالبی جدا فقط اگر ورد دعوت مالک سالن باید متفاوت باشد؛ در غیر این صورت
      خالی بگذارید تا generic استفاده شود.
- [ ] **قالب `invite-specialist` ساخته شود** — `KAVENEGAR_INVITE_SPECIALIST_TEMPLATE`.
      همان شرط بالا برای دعوت متخصص.
- [ ] **E2E با دو شماره واقعی** — یک شماره مالک سالن، یکی متخصص. از پنل دعوت
      صادر کنید، SMS را روی گوشی دریافت کنید، روی `${INVITE_BASE_URL}?token=…`
      بزنید و ببینید نقش درست با OTP ساخته می‌شود.

> **توجه:** `INVITE_BASE_URL` بدنهٔ پیام را تعیین می‌کند — `sendInviteSms`
> از `${INVITE_BASE_URL}?token=<64hex>` می‌سازد و وقتی ست نیست فقط خود token
> (یک hex ۶۴ کاراکتری) ارسال می‌شود که چیزی نمی‌تواند باز کند. دامنهٔ staging
> تا زمانی که دامنهٔ نهایی روشن شود کافی است.
>
> **به‌جای SMS واقعی:** `backend/scripts/test-invite.sh` (که ignore شده و
> commit نمی‌شود) کل مسیر را در SQL روی دیتابیس dev می‌برد و لینک را چاپ
> می‌کند، بدون اینکه کاوه‌نگار را صدا بزند.
> برای تست HTTP واقعی `backend/scripts/test-invite-api.sh` (به همان شکل ignore شده)
> وجود دارد: `POST /api/v1/auth/invite` را روی پورت ۳۰۰۱ با JWT ادمین صدا می‌زند
> و توکن یک‌باره را برمی‌گرداند.
>
> **راهنمای کامل:** `docs/report/KAVENEGAR-SETUP.md` — ساخت قالب در پنل کاوه‌نگار
> (شامل سینتکس تک‌متغیره `%token`)، متغیرهای محیطی، و نحوهٔ اعمال env روی staging.