# Phase: محصول — چک‌لیست

> مرجع: ADR-010 (invite tokens) و PROJECT_CHARTER.md
> آخرین به‌روزرسانی: 2026-10-06

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

## Onboarding متخصص
- [ ] salon_app: صفحه «دعوت متخصص»
- [ ] فرآیند: salon_owner → invite → accept → role=specialist
- [ ] تست: ورود متخصص + مشاهده رزروها

## مدل کسب‌وکار (فاز ۲)
- [ ] PAYMENTS_ENABLED=true
- [ ] CommissionSplitService جدا
- [ ] تست Zarinpal در sandbox
- [ ] تعیین درصد نهایی کمیسیون
