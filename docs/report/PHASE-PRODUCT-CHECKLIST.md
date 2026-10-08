# Phase: محصول — چک‌لیست

> مرجع: ADR-010 (invite tokens) و PROJECT_CHARTER.md
> آخرین به‌روزرسانی: 2026-10-08

## Invite System (ADR-010)
- [x] Backend: service + endpoints
- [x] RolesGuard
- [x] admin-panel UI (create/list/revoke)
- [x] SMS template
- [ ] تست end-to-end با SMS واقعی (Kavenegar)

## Onboarding مدیر سالن
- [x] Backend: `POST /tenants` (فقط admin، DTO `name`+`slug`، ۴۰۹ برای slug تکراری، وضعیت اولیه `draft`)
- [x] admin-panel: صفحه «ساخت سالن جدید» (`tenants/create` + `TenantForm`؛ ساخت سالن و صدور دعوت مدیر با نمایش یک‌بارهٔ توکن)
- [x] فرآیند: admin → invite → accept → role=salon_owner (integration: `tenant-onboarding` — ۳ تست)
- [ ] تست: ورود مدیر + مشاهده پنل (دستی، پس از تأیید سالن)

> **یادداشت `is_active` در برابر `status` (بررسی ۲۰۲۶-۱۰-۰۶):** تناقضی وجود ندارد و عمدی است.
> `is_active` کلید خاموش/روشن اپراتور است (در `tenants`، `specialists`، `services`، `users` یکسان)،
> و `status`/`approved_at` چرخهٔ تأیید هستند. کاتالوگ عمومی با
> `t.approved_at IS NOT NULL AND t.status <> 'suspended'` **به‌همراه** `t.is_active = true` فیلتر می‌شود
> (`salon.service.ts`), پس `create` با `status='draft'` و `isActive=true` درست است: سالن «فعال» است
> (اپراتور خاموشش نکرده) ولی چون `approved_at` تهی است دیده نمی‌شود. گره‌زدن صریح `isActive`
> به `status` همان باگی است که کامنت کد دربارهٔ آن هشدار می‌دهد (خارج‌شدن سالن زنده از جست‌وجو با
> یک ویرایش سادهٔ پروفایل). مسیر درست: تأیید ادمین در `PATCH /admin/tenants/:id/status` هم‌اکنون
> `status='approved', approved_at=NOW()` را ست می‌کند و سالن را منتشر می‌کند.

## Onboarding متخصص
- [x] salon_app: صفحه «دعوت متخصص» (`invite_specialist_screen.dart` + `invite_api.dart`؛ فرم شماره+نقش، نمایش یک‌بارهٔ توکن و دکمهٔ کپی، روت `/specialists/invite`)
- [x] فرآیند: salon_owner → invite → accept → role=specialist (integration: `specialist-onboarding` — ۵ تست؛ accept خودکار رکورد `specialists` می‌سازد + `tenant-visibility` ۵ تست روی `SalonService.list`)
- [ ] تست: ورود متخصص + مشاهده رزروها (دستی، پس از پیوستن)

## ویترین مشتری (customer_app)
- [x] home feed به API واقعی وصل شد — حالت‌های loading/error/empty + pull-to-refresh (mock حذف شد، `8bd56ec`)
- [ ] صفحهٔ کامل لیست سالن‌ها (دکمهٔ «همه» در home فعلاً no-op است)
- [ ] search screen حالت error بگیرد تا `nearbySalonsProvider` مشترک حذف شود

## مدل کسب‌وکار (فاز ۲)
- [ ] PAYMENTS_ENABLED=true
- [ ] CommissionSplitService جدا
- [ ] تست Zarinpal در sandbox
- [ ] تعیین درصد نهایی کمیسیون
