# گزارش وضعیت پروژه BOYA — فهرست

تاریخ گزارش: 2026-10-03
محل تولید: `e:\BOYA platform\docs\report\`
زبان: توضیحات فارسی، کد و مسیر انگلیسی

> نکته مهم برای مشاور فنی: این پروژه **فاز ۱ ویترین رایگان** است (طبق `PROJECT_CHARTER.md`).
> پرداخت آنلاین عمداً خاموش است (`PAYMENTS_ENABLED=false`). هر چیزی که درباره Stripe/Split در
> درخواست اولیه آمده بود، در کد فعلی **وجود ندارد** — درگاه واقعی `Zarinpal` است و آن هم غیرفعال.

| فایل | محتوا |
|------|--------|
| `01-overview-stack.md` | ساختار monorepo، کانفیگ ریشه، استک فنی دقیق، env |
| `02-database-rls.md` | **(اولویت)** لایه دیتابیس: ۲۷ migration، RLS، policyها، Exclusion Constraint، entityها، tenant context، توابع SECURITY DEFINER |
| `03-auth-booking.md` | **(اولویت)** احراز هویت/امنیت (OTP/JWT) + رزرو (الگوریتم slot، Exclusion، تراکنش، no-show) |
| `04-payment-cancellation.md` | **(اولویت)** پرداخت/Zarinpal، کنسلی/no-show (جریمه ۵۰٪/۱۰۰٪، refund دستی) |
| `05-flutter-tests-bugs-deploy.md` | **(اولویت)** اپ‌های Flutter، تست‌ها (unit/e2e/integration)، باگ‌ها، داکر/CI، سؤال‌های مشاور |
| `07-code-review-2026-10-21.md` | بررسی کد ۲۱ اکتبر: رفع باگ timezone تاریخ جلالی (ADR-012)، رفع `TypeOrmModule` تکراری، وضعیت lint/test/build و استقرار |

بخش‌های کلیدی درخواستی (۳، ۵، ۶، ۹، ۱۰) در فایل‌های 02 تا 05 با کد کامل آمده‌اند.

---

## خلاصه ۸ یافتهٔ بحرانی (جزئیات در فایل مربوطه)

| # | یافته | فایل |
| --- | --- | --- |
| BUG-1 | JOIN `users→tenants` در `reminder.scheduler.notify()` → **SMS یادآوری هرگز برای مشتری ارسال نمی‌شود** (`users.tenant_id` برای مشتری `NULL` است) | ۰۵ §۵.۶ |
| BUG-2/3 | `refund()` هیچ پولی برنمی‌گرداند (`manual-*`) و `markRefundPending` بدون دیتابیس-تراکنش → رزرو کنسل می‌ماند بدون بازگشت پول | ۰۴ §۴.۳ |
| BUG-4/5 | `findById`/`cancel`/`markReviewed`/`confirmVisitByCustomer` بدون `setTenantContext` روی جداول `FORCE RLS` | ۰۳ §۳.۴ |
| BUG-6 | `POST /payments/initiate` مقدار `tenantId` را از **بدنه** می‌گیرد نه از توکن | ۰۴ §۴.۶ |
| RISK-1/2/3 | CI **هیچ integration/e2e/Flutter test اجرا نمی‌کند**؛ `describe.skip` در غیاب Postgres = سبز بی‌مفهوم | ۰۵ §۵.۴ |
| RISK-7 | `README`+`env.validation` از Stripe می‌گویند، کد فقط Zarinpal دارد؛ `STRIPE_SECRET_KEY` الزامی ولی مصرف‌نشده | ۰۴ §۴.۸ |
| RISK-5 | لایه API/مدل مشترک Flutter خالی است (`dio`/`retrofit`/`freezed` بلااستفاده) | ۰۵ §۵.۱ |
| RISK-12 | مهاجرت ۲۷ (`UnifyTenantGuc`) غیرقابل بازگشت؛ اگر در محیط موجود اجرا نشده باشد، داده tenant‌محور **بی‌صدا صفر** می‌شود | ۰۲ §۲.۴ |

## آنچه وجود ندارد (صریح)
Stripe / Stripe Connect / Split Payments ❌ · escrow ❌ · پرداخت آنلاین فعال ❌ · بازپرداخت واقعی ❌ · تسویه خودکار متخصص ❌ · صف BullMQ فعال ❌ · CLS/AsyncLocalStorage برای tenant ❌ · سطح ایزولاسیون SERIALIZABLE/REPEATABLE READ ❌ · سایت `web\` ❌ · Dockerfile/compose ❌

## آنچه واقعاً وجود دارد (و خوب است)
RLS + `FORCE` + `NOBYPASSRLS` ✅ · Exclusion Constraint جزئی + ترجمه `23P01`/`40P01` ✅ · توابع `SECURITY DEFINER` برای خروج امن ✅ · OTP با pepper + timing-safe ✅ · idempotency سه‌لایه پرداخت ✅ · ۳ اسپک integration هدف‌مند (RLS/Exclusion/GUC) ✅ · RTL کامل و جلالی ✅


