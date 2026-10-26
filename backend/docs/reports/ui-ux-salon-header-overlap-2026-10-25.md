# تاییدیه اصلاح هم‌پوشانی UI صفحه جزئیات سالن + تطابق برند + سلامت flutter analyze

**تاریخ:** 2026-10-25
**دامنه:** `mobile/customer_app` — صفحهٔ جزئیات سالن (`salon_detail_screen.dart`) و هدر مشترک (`boya_app_bar.dart`)

---

## ۱) اصلاح هم‌پوشانی نام سالن با عناوین منو و دکمه‌های هدر ✅

**ریشهٔ هم‌پوشانی (بر اساس سورس Flutter SDK):**
صفحه از `BoyaAppBar.sliver` با `FlexibleSpaceBar` و `expandedHeight: 160` و `bottom: TabBar`
استفاده می‌کرد. دو مشکل ساختاری وجود داشت:

1. **هم‌پوشانی عمودی با عناوین منو:** فضا Flexible از پشت `TabBar` (۴۸px) عبور می‌کند و
   `FlexibleSpaceBar` به‌طور پیش‌فرض عنوان را با `bottom: 16` پایین‌تر از لبهٔ پایینی قرار می‌دهد —
   یعنی عنوان مستقیماً روی برچسب‌های «خدمات / متخصصان / نمونه‌کارها» می‌افتاد.
2. **هم‌پوشانی افقی با دکمه‌های هدر:** عنوان `Text` هیچ `maxLines`/`overflow` نداشت. نام سالن تا
   ۲۰۰ نویسه است (DTO سمت سرور)، پس یک نام بلند می‌پیچید و از زیر دکمهٔ بازگشت و دکمهٔ خانه
   رد می‌شد.

**اصلاح انجام‌شده** در `mobile/customer_app/lib/shared/widgets/boya_app_bar.dart`
(مکان مشترک؛ تنها مصرف‌کنندهٔ حالت sliver همین صفحه است):

```dart
final title = Text(
  this.title,
  maxLines: 1,                      // نام ۲۰۰ نویسه‌ای هرگز نمی‌پیچد
  overflow: TextOverflow.ellipsis,
  style: BoyaTypography.title.copyWith(color: foreground),
);
…
flexibleSpace: FlexibleSpaceBar(
  title: title,
  titlePadding: EdgeInsetsDirectional.only(
    start: kToolbarHeight,                          // صاف شدن از دکمهٔ back
    end: kToolbarHeight,                            // صاف شدن از دکمهٔ home
    bottom: (bottom?.preferredSize.height ?? 0) + 16,  // صاف شدن ازTabBar پین‌شده
  ),
  background: flexibleSpaceBackground,
),
```

**محاسبهٔ هندسی (در حالت بازشده):** ارتفاع کل = topPadding + 160؛ عنوان در `160 - 64 = 96` از
بالای فضا و `TabBar` از `160 - 48 = 112` آغاز می‌شود → ۱۶px فاصلهٔ تضمین‌شده. در حالت جمع‌شده
(minExtent = statusbar + 56 + 48) عنوان در مرکز نوار ابزار (محور ~۵۰) می‌نشیند و هرگز با زبانه‌ها
هم‌پوشانی نمی‌کند. هردکمه نیز دقیقاً ۵۶px (یک slot کامل) فاصله دارد.

**تاییدیه:** ✅ هم‌پوشانی نام سالن با عناوین منو و دکمه‌های هدر ساختاریاً برطرف شد
(کد به جای وابستگی به رندر تصویری، از روی رفتار تأییدشدهٔ SDK محاسبه شده است).

## ۲) تطابق توکن‌های هویت بصری بویا ✅

توکن‌ها در سورس تأیید شدند (بدون تغییر نیاز):
- **رنگ سبز نفتی:** `BoyaColors.primary = Color(0xFF173B3F)` (`boya_colors.dart:7`).
  هدر صفحه جزئیات سالن: `backgroundColor: BoyaColors.primary`، `foregroundColor: BoyaColors.white`،
  نشانگر و برچسب‌های `TabBar` سفید. ✅ مطابق راهنمای برند.
- **فونت:** `BoyaTypography.fontFamily = 'Vazirmatn'` (`boya_typography.dart:10`) با fallbackهای
  `IRANSans/RobotoPR/system-ui`. `BoyaTheme.light()` فونت Vazirmatn را جهانی می‌کند و عنوان هدر و
  برچسب زبانه‌ها هر دو از سبک‌های `BoyaTypography` استفاده می‌کنند. ✅
- ⚠️ **بازمانده از دور قبل:** خود فایل‌های TTF در `mobile/shared/assets/fonts/` هنوز
  placeholder هستند؛ فونت تا زمان نسخه‌برداری نهایی به fallback سیستم می‌افتد. (در صورت تمایل، در
  دور بعدی با قرار دادن فایل‌های اصلی و `flutter pub get` بسته می‌شود.)

## ۳) سلامت `flutter analyze` ✅

```
$ cd mobile/customer_app && flutter analyze
Analyzing customer_app...
No issues found! (ran in 5.2s)   ← صفر اخطار
```

## خلاصه
| مورد | وضعیت |
|---|---|
| هم‌پوشانی نام سالن ↔ عناوین منو (TabBar) | ✅ اصلاح شد (`titlePadding.bottom`) |
| هم‌پوشانی نام سالن ↔ دکمه‌های هدر | ✅ اصلاح شد (`maxLines: 1` + ellipsis + inset ۵۶px) |
| رنگ هفت‌رنگ برند #173B3F در هدر | ✅ تأیید شد |
| فونت Vazirmatn در هدر و عناوین | ✅ تأیید شد (فایل TTF واقعی هنوز جایش خالی است) |
| `flutter analyze` customer_app | ✅ بدون مشکل |

### 💭 Nit
- `DefaultTabController(length: 3)` در `salon_detail_screen.dart` بلااستفاده است (کنترلر اختصاصی
  `_tabs` کار را می‌کند) — حذفش در دور بعدی.
