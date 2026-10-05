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
- [ ] JWT refresh: rotation + revocation strategy؟
      (بک‌اند `JWT_REFRESH_SECRET` را تعریف می‌کند ولی طبق گزارش ۰۳ مصرف نمی‌شود — B6)
- [ ] `flutter_secure_storage` جای `SharedPreferences`
      (برای نگهداری access/refresh token روی دستگاه)

### کارهای باقی‌مانده از فاز زیرساخت
- [ ] `web/specialist/` و جدول `web/README.md` هنوز به یک اپ جداگانه اشاره
      می‌کنند؛ یا `web/specialist/` حذف شود یا صرفاً به نقش در `salon_app`
      اشاره کند.
- [x] ~~**`pubspec.lock` برای اپ‌ها commit نمی‌شود**~~ — **بسته شد 2026-10-05**
      (commit `cceb453`). خط سراسری `pubspec.lock` در `.gitignore` با
      `/mobile/shared/pubspec.lock` جایگزین شد: فقط lockfile پکیج کتابخانه‌ای
      ignore می‌شود و lockfile هر دو اپ track می‌شود تا build قابل بازتولید باشد.
- [x] ~~`fl_chart` در `salon_app` اعلام نشده بود~~ — **بسته شد 2026-10-05**؛
      `flutter analyze` در هر سه پکیج پاک است.