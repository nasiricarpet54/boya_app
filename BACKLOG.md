# BACKLOG

## Lint Issues (TODO)

Verified with ESLint 8.57.1 + `@typescript-eslint` (config: `backend/.eslintrc.js`).
`npm run lint` runs with `--max-warnings 0`, so every warning below fails the
command. CI runs the lint step with `continue-on-error: true` until this list
is empty.

- [ ] `backend/src/database/migrations/1730000000007-MakeUserTenantNullable.ts:14` — `@typescript-eslint/no-unused-vars` (warn) — پارامتر `queryRunner` در `down()` استفاده نمی‌شود؛ با پیشوند `_` اصلاح شود
- [ ] `backend/src/modules/admin/audit-logs/admin-audit-logs.service.ts:8` — `@typescript-eslint/no-unused-vars` (warn) — `TARGET_TYPES` فقط به‌عنوان type استفاده می‌شود؛ `const` بی‌مصرف است
- [ ] `backend/src/modules/auth/auth.service.ts:3` — `@typescript-eslint/no-unused-vars` (warn) — `InjectRepository` ایمپورت شده ولی استفاده نمی‌شود
- [ ] `backend/src/modules/notification/services/reminder.scheduler.ts:6` — `@typescript-eslint/no-unused-vars` (warn) — `BookingStatus` ایمپورت شده ولی استفاده نمی‌شود
- [ ] `backend/test/setup/pg-client.ts:34` — `@typescript-eslint/no-require-imports` (**error**) — `require('pg')` به‌عمد است چون `@types/pg` نصب نیست و `pg` بدون type است؛ کامنت disable موجود_name اشتباه است (`no-var-requires` به‌جای `no-require-imports`)
- [ ] `backend/test/setup/test-db.ts:99` — `@typescript-eslint/no-require-imports` (**error**) — همان مورد بالا برای `require('ts-node').register(...)`؛ کامنت disable موجود هم rule اشتباه را خاموش می‌کند

**جمع:** ۴ warning + ۲ error (زیر آستانهٔ ۵۰، پس `--max-warnings` دست‌نخورده ماند).

### نکتهٔ راهبردی برای دو مورد error
هر دو `no-require-imports` **عمدی** هستند و با `@types/pg` نبودن توضیح داده شده‌اند
(به `pg-client.ts` هدر فایل نگاه کنید). راه درست، خاموش‌کردن این rule برای
`test/setup/**` است، نه تغییر کد. کامنت‌های `eslint-disable-next-line
@typescript-eslint/no-var-requires` که الان در فایل هستند rule اشتباهی را
خاموش می‌کنند و باید به `no-require-imports` تغییر کنند.

## Blocker: eslint نصب نمی‌شود (lockfile خراب)

`npm i -D eslint@8 @typescript-eslint/parser @typescript-eslint/eslint-plugin`
در این ریپو با خطای زیر می‌شکند:

```
npm error TypeError: Invalid Version:
npm error   at new Semver (.../semver/classes/semver.js:40:13)
npm error   at Node.canDedupe (.../@npmcli/arborist/lib/node.js:1140:32)
npm error   at PlaceDep.pruneDedupable (.../arborist/lib/place-dep.js:426:14)
```

**علت ریشه‌ای:** در `backend/package-lock.json` **۲۷ ورودی `version` ندارند** — همه
اختیاری و platform-specific هستند:
`node_modules/jest-haste-map/node_modules/fsevents`،
`@msgpackr-extract/msgpackr-extract-*` (۴ مورد) و
`@unrs/resolver-binding-*` (۲۱ مورد).
`canDedupe` روی `undefined` صدای `semver.compare` را می‌زند و می‌ترکد.

این خرابی **پیش‌بین این تغییر** است و ربطی به eslint ندارد.

### چرا eslint را به `package.json` اضافه نکردم
اگر eslint را فقط به `package.json` اضافه کنیم بدون اینکه lockfile هم sync شود،
`npm ci` در CI با خطای زیر می‌شکند و **کل jobها قرمز می‌شوند**:

> npm ci can only install packages when your package.json and package-lock.json
> are in sync

پس تا وقتی lockfile درست نشود، افزودن dependency به `package.json` ریسک
خرابی کل CI را دارد.

### ترتیب پیشنهادی رفع
۱. حذف آن ۲۷ ورودی version-less از `backend/package-lock.json` (اختیاری و
   platform-specific هستند؛ npm خودش از manifest دوباره resolve می‌کند).
۲. `npm install` در `backend` برای بازسازی lockfile.
۳. `npm i -D eslint@8 @typescript-eslint/parser @typescript-eslint/eslint-plugin`
۴. حذف `continue-on-error` از `.github/workflows/backend.yml`.
۵. پاک‌کردن لیست بالا و کاهش تدریجی سخت‌گیری lint.