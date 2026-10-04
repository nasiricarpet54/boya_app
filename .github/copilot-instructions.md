# BOYA (بویا) Platform - Development Guidelines

## Project Identity
- **Name:** BOYA (بویا)
- **Type:** Multi-tenant beauty services marketplace (like Snappfood for beauty)
- **Target Market:** Iran
- **Languages:** Persian (primary), English (secondary)
- **Calendar:** Jalali (Shamsi) with Saturday as week start
- **Weekend:** Friday (جمعه)

## Code Language Rules
- **All user-facing text:** Persian (فارسی)
- **All code comments:** English
- **All commit messages:** English
- **All documentation:** Persian and English (bilingual)
- **All error messages (user-facing):** Persian
- **All API responses:** Persian messages in `message` field

## Typography Rules (CRITICAL)
- **Primary font:** Vazirmatn (وزیرمتن) - MUST be used everywhere
- **Fallback:** IRANSans, then system fonts
- **Numbers:** Persian numerals (۱۲۳۴۵۶۷۸۹۰) in all UI
- **Dates:** Jalali calendar format (۱۴۰۵/۰۱/۱۵)
- **Text direction:** RTL (راست‌چین) for all Persian content

## Color Rules
- **Primary:** #B87333 (Deep Copper - مس عمیق)
- **Secondary:** #E8B4A0 (Rose Gold - رزگلد)
- **Neutral Dark:** #1A1A2E (Ink Black - مشکی مرکبی)
- **Neutral Light:** #FAF7F2 (Soft Cream - کرم ملایم)
- **Success:** #2E7D32
- **Error:** #D32F2F

## Date & Time Rules (CRITICAL)
- **Calendar:** Jalali (Shamsi) ONLY for user-facing dates
- **Week start:** Saturday (شنبه)
- **Weekend:** Friday (جمعه) - شاخص تعطیلی
- **Date picker:** Must use parsi_datetime_picker package
- **Date format:** ۱۴۰۵/۰۱/۱۵ (no leading zeros in month/day unless needed)
- **Time format:** ۱۴:۳۰ (24-hour, Persian numerals)

## Flutter-Specific Rules
- Use `Directionality(textDirection: TextDirection.rtl)` at app root
- Use `Locale('fa', 'IR')` as primary locale
- Use `parsi_datetime_picker` for all date inputs
- Use `text_fa` package for mixed Persian/English text
- Use `Vazirmatn` font family everywhere
- Use `flutter_localizations` with `GlobalMaterialLocalizations`

## Backend-Specific Rules
- All API responses include `message` field in Persian
- Timezone: Asia/Tehran (IRST, UTC+3:30)
- Store dates as UTC, convert to Jalali for display
- Use `date-fns-jalali` for Jalali display. Do not add a second calendar library.
- SMS templates in Persian

## Client Priority
- **Primary product:** the three Flutter apps (customer, salon, specialist)
- **Web panels:** one test panel per app, under `web/`. They mirror the apps for browser testing and are not a second product
- **Shared rules:** Persian UI, RTL, Vazirmatn, Jalali display, and the same API as the apps
- **Do not:** add web-only business logic, or let web work block the apps

## Testing Rules
- All test descriptions in English
- Test data: Persian names and text
- Date assertions: Use Jalali dates
- Snapshot tests: Persian UI

## Security & Privacy
- Follow Iranian e-commerce law (قانون تجارت الکترونیکی)
- User data protection required
- Location data: explicit consent
- All PII encrypted at rest

