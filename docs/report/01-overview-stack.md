# ۰۱ — نمای کلی، پشته فنی و ساختار مونوریپو

> سند وضعیت پروژه پلتفرم BOYA — تاریخ تهیه: ۲۰۲۶-۱۰-۰۳
> دامنه: کل مونوریپوی `e:\BOYA platform` (بک‌اند NestJS + ۴ پکیج Flutter + پنل ادمین Next.js + پشتیبان‌های داکر و CI).

---

## ۱.۱ ماهیت محصول (از `PROJECT_CHARTER.md`)

BOYA یک پلتفرم رزرو نوبت خدمات زیبایی (سالن‌ها، متخصص‌ها، خطوط خدمت) است. منشور پروژه صریحاً دامنه **فاز اول** را محدود کرده است:

**پلتفرم انجام نمی‌دهد:**
- پردازش پرداخت آنلاین
- دریافت کمیسیون از معاملات
- نگه‌داری پول در حساب واسط (escrow)
- پردازش بازپرداخت واقعی
- تقسیم درآمد بین ذی‌نفعان (split revenue)

**پلتفرم انجام می‌دهد:**
- معرفی و ویترین سالن‌ها و متخصص‌ها
- رزرو نوبت با گردش‌کار تأیید از سمت سالن
- یادآوری نوبت (SMS/push/درون‌برنامه‌ای)
- مدیریت عدم‌حضور (no-show) و سیاست کنسلی

> نتیجه‌گیری مهم برای مشاور: هر ادعایی درباره «پرداخت آنلاین»، «Stripe»، «تقسیم درآمد» یا «بازپرداخت سیستمی» **باید با احتیاط خوانده شود**؛ کد موجود صرفاً اسکلت این قابلیت‌ها را برای فاز دوم نگه داشته است (بخش ۰۵ همین گزارش).

---

## ۱.۲ ساختار ریشه مونوریپو

مطابق `README.md` ریشه، همه‌چیز در یک ریشه جمع شده و شکستن آن به ریپوهای جدا ممنوع است:

```
e:\BOYA platform\
├── .github\            # copilot-instructions.md + workflows (backend.yml, mobile.yml)
├── admin-panel\        # Next.js App Router (پنل ادمین پلتفرم)
├── backend\            # NestJS + TypeORM + PostgreSQL
├── design_system\      # توکن‌ها/کامپوننت‌های مشترک طراحی
├── docker\             # postgres\init\01-roles.sql
├── docs\               # مستندات؛ این گزارش زیر docs\report\
├── mobile\             # ۴ پکیج Dart/Flutter
└── web\                # سایت بازاریابی — در حال حاضر فقط README.md
```

نکته قابل ذکر: پوشه `web\` در این مرحله **عملاً خالی است** (تنها یک `README.md`) و پوشه `design_system\` نیز عمدتاً محل نگه‌داری توکن‌های طراحی است، نه یک اپلیکیشن مستقل.

---

## ۱.۳ پشته فنی دقیق (فایل‌به‌فایل)

### بک‌اند (`backend\package.json`)

| حوزه | کتابخانه | نسخه | توضیح |
| --- | --- | --- | --- |
| فریم‌ورک | `@nestjs/common`, `@nestjs/core` | — | NestJS 11 |
| ORM | `typeorm` | `0.3.27` | با `synchronize: false` |
| دیتابیس | `pg` / PostgreSQL | — | افزونه‌های `btree_gist`, `pgcrypto` |
| Redis | `ioredis` | — | برای کش/OTP/Rate limit |
| احراز هویت | `@nestjs/jwt`, `passport-jwt` | — | access + refresh token |
| زمان‌بندی | `@nestjs/schedule` | — | cron های `ReminderScheduler` |
| رویداد | `@nestjs/event-emitter` | — | رویدادهای دامنه (`booking.created` …) |
| فایل/چندرسانه | `sharp` | — | پردازش تصاویر نمونه‌کار |
| پیامک | `@mirad-work/sms-nestjs` + `@mirad-work/sms-core` | `0.5.0` / `0.5.1` | Kavenegar، قالب‌های فارسی |
| پوش | `firebase-admin` | `14.5.0` | نیازمند Node 22+ |
| پرداخت | `stripe` | `22.6.2` | **در `package.json` هست اما در `src` هیچ‌جا import نشده** |
| مستندات API | `@nestjs/swagger` | — | Swagger در `/docs` |

> **شکاف مستندشده:** `README.md` خط ۹۱ می‌گوید «Payments: `stripe` 22.6.2 — Stripe Connect split payments»، اما در کل درخت `backend\src` حتی یک `import ... from 'stripe'` وجود ندارد. تأمین‌کننده واقعی پرداخت `ZarinpalPaymentProvider` است. این تناقض برای مشاور باید صریح علامت‌گذاری شود.

### موبایل (`mobile\`)

چهار پکیج Dart/Flutter:

1. `mobile\customer_app\` — اپ مشتری. پوشه `lib\features\` شامل: `auth`, `booking`, `home`, `notifications`, `profile`, `salon`.
2. `mobile\salon_app\` — اپ سالن. پوشه `lib\features\` شامل: `auth`, `bookings`, `dashboard`, `finance`, `portfolio`, `profile`, `salon`, `services`, `specialists`.
3. `mobile\specialist_app\` — اپ متخصص. پوشه `lib\features\` شامل: `bookings`, `dashboard`, `profile`, `schedule`.
4. `mobile\shared\` — پکیج مشترک. محتویات واقعی `lib\`:
   - `boya_shared.dart` (فایل barrel) و `beauty_shared.dart` (فایل قدیمی/نام‌گذاری پیشین)
   - `app\boya_app.dart`
   - `theme\boya_colors.dart`, `theme\boya_theme.dart`, `theme\boya_typography.dart`
   - `localization\fa.json`, `localization\en.json`
   - `utils\jalali_date_utils.dart`, `utils\persian_number_utils.dart`, `utils\text_direction_utils.dart`
   - `widgets\boya_date_picker.dart`, `widgets\boya_logo.dart`
   - پوشه‌های `api\`, `models\`, `widgets\` فقط `.gitkeep` دارند → **لایه API/مدل مشترک عملاً خالی است** و هر اپ مدل خودش را دارد.

اتصال به بک‌اند از طریق `--dart-define=API_BASE_URL` با پیش‌فرض `http://localhost:3000/api/v1`.

### پنل ادمین (`admin-panel\`)

Next.js App Router با ساختار i18n لوکال (`src\app\[locale]`):

```
src\app\[locale]\
├── login\
└── (protected)\
    ├── approvals\        # صف تأیید سالن/متخصص
    ├── audit-logs\       # لاگ اقدامات مدیران
    ├── dashboard\
    ├── settings\
    ├── tenants\ + tenants\[id]\
    ├── transactions\     # placeholder فاز ۱ (PAYMENTS_ENABLED=false)
    └── users\ + users\[id]\
```

لایه داده: `src\lib\api\` با فایل‌های `approvals.ts`, `audit.ts`, `auth.ts`, `client.ts`, `dashboard.ts`, `errors.ts`, `tenants.ts`, `users.ts`. احراز هویت سمت کلاینت در `src\lib\stores\auth.ts` و `src\components\auth\RequireAuth.tsx`. مسیرهای محافظت‌شده با `src\middleware.ts`.

---

## ۱.۴ متغیرهای محیطی

منبع حقیقت برای اعتبارسنجی: `backend\src\config\env.validation.ts` (کلاس `EnvironmentVariables` با `class-validator`).

**الزامی (بدون مقدار پیش‌فرض):**
`DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `REDIS_HOST`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `KAVENEGAR_API_KEY`, `OTP_PEPPER`

**اختیاری / دارای پیش‌فرض:**
`NODE_ENV`, `PORT`, `API_PREFIX`, `DATABASE_PORT`, `DATABASE_SSL`, `REDIS_PORT`, `REDIS_PASSWORD`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `STRIPE_CONNECT_CLIENT_ID`, `PAYMENTS_ENABLED` (**پیش‌فرض `false`**), `KAVENEGAR_SENDER`, `KAVENEGAR_OTP_TEMPLATE`, `KAVENEGAR_BOOKING_TEMPLATE`, `ZARINPAL_MERCHANT_ID`, `ZARINPAL_CALLBACK_URL`, `ZARINPAL_SANDBOX`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `NESHAN_API_KEY`, `CORS_ORIGINS`

> **نکته امنیتی/عملیاتی:** `STRIPE_SECRET_KEY` و `STRIPE_WEBHOOK_SECRET` در اعتبارسنجی **الزامی** هستند، در حالی که هیچ کدی از Stripe استفاده نمی‌کند. یعنی نبودن این دو کلید باعث شکست بوت می‌شود، هرچند بی‌مصرف‌اند. این یک بدهی فنی مشخص برای فاز دوم است.

**پیکربندی‌های گروه‌بندی‌شده:** `backend\src\config\services.config.ts` سه بلوک `registerAs` دارد: `stripe` (`secretKey`, `webhookSecret`, `connectClientId`)، `kavenegar` (`apiKey`, `sender`) و `neshan` (`apiKey`).

**پایگاه‌داده در حالت مهاجرت:** `backend\src\database\data-source.migration.ts` اجازه می‌دهد مهاجرت‌ها با نقش دیگری اجرا شوند: `DATABASE_MIGRATION_USER` / `DATABASE_MIGRATION_PASSWORD` / `DATABASE_MIGRATION_NAME` / `DATABASE_MIGRATION_PORT` (پیش‌فرض‌ها به `DATABASE_*` برمی‌گردند). این جداسازی نقش migrate از نقش runtime، ستون فقرات مدل امنیتی RLS است (بخش ۰۲).

---

## ۱.۵ جمع‌بندی سریع

| موضوع | وضعیت |
| --- | --- |
| بک‌اند NestJS | ✅ کامل و فعال |
| PostgreSQL + RLS | ✅ پیاده‌سازی شده (با تناقض GUC — بخش ۰۲) |
| احراز هویت OTP/JWT | ✅ فعال |
| رزرو + Exclusion Constraint | ✅ فعال |
| پرداخت آنلاین | ⛔ موجود اما **خاموش** (`PAYMENTS_ENABLED=false`) |
| Stripe / Split Payments | ❌ **وجود ندارد** (فقط نام در مستندات و `package.json`) |
| Zarinpal | ⚠️ کد کامل، اما غیرفعال؛ بازپرداخت واقعی انجام نمی‌شود |
| اپ مشتری/سالن/متخصص | ✅ هر سه موجود، با پراکندگی مدل |
| اپ متخصص (اتصال به API) | ⚠️ ناقص — بخش ۰۵ |
| پنل ادمین | ✅ صفحات اصلی موجود (transactions placeholder) |
| `web\` | ❌ خالی (فقط README) |
| تست‌های بک‌اند | ⚠️ ۶ فایل spec، بدون integration test — بخش ۰۵ |
| CI | ✅ دو workflow (backend, mobile) |

