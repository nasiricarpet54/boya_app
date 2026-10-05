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

## نکتهٔ محیطی: شبکه

در این ماشین `registry.npmjs.org` مدام `ECONNRESET` می‌داد و نصب‌ها شکست می‌خوردند
(خطای npm: `Exit handler never called!`). با
`npm config set registry https://registry.npmmirror.com` نصب‌ها سالم شدند.
این تنظیم **سراسری روی این ماشین** است، نه مخصوص پروژه.