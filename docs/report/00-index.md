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
| `02-database-rls.md` | **(اولویت)** لایه دیتابیس: migrationها، RLS، policyها، Exclusion Constraint، entityها، tenant context |
| `03-auth-booking.md` | **(اولویت)** احراز هویت/امنیت + رزرو (الگوریتم slots، هندل Exclusion، ترنزکشن) |
| `04-payment-cancellation.md` | **(اولویت)** پرداخت/Zarinpal، کنسلی/no-show (جریمه ۵۰٪/۱۰۰٪، refund دستی) |
| `05-flutter-tests-bugs-deploy.md` | **(اولویت)** هر سه اپ Flutter، تست‌ها، باگ‌ها/TODO، داکر/CI، سوالات برای مشاور |

بخش‌های کلیدی درخواستی (۳، ۵، ۶، ۹، ۱۰) در فایل‌های 02 تا 05 با کد کامل آمده‌اند.
