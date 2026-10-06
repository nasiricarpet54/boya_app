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
- [ ] admin-panel: صفحه «ساخت سالن جدید»
- [ ] فرآیند: admin → invite → accept → role=salon_owner
- [ ] تست: ورود مدیر + مشاهده پنل

## Onboarding متخصص
- [ ] salon_app: صفحه «دعوت متخصص»
- [ ] فرآیند: salon_owner → invite → accept → role=specialist
- [ ] تست: ورود متخصص + مشاهده رزروها

## مدل کسب‌وکار (فاز ۲)
- [ ] PAYMENTS_ENABLED=true
- [ ] CommissionSplitService جدا
- [ ] تست Zarinpal در sandbox
- [ ] تعیین درصد نهایی کمیسیون
