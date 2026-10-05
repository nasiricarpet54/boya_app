# ۰۵ — اپ‌های Flutter، تست‌ها، باگ‌ها و استقرار

> اولویت: **بالا**
> دامنه: `mobile\*` (چهار پکیج), `backend\test\**`, `.github\workflows\**`, `docker\**`

---

## ۵.۱ اپ‌های موبایل — ساختار واقعی

### ۵.۱.۱ پکیج مشترک `mobile\shared\` (`boya_shared`)

`pubspec.yaml`:

- نام پکیج: `boya_shared`, نسخه `1.0.0`, `publish_to: none`
- SDK: Dart `^3.12.0`, Flutter `>=3.44.0`
- مدیریت state: **Riverpod** (`flutter_riverpod ^3.4.3` + `riverpod_annotation ^4.0.7`)
- مسیریابی: `go_router ^18.0.1`
- شبکه: `dio ^5.11.1` + `retrofit ^4.10.0` + `json_annotation`
- مدل‌سازی: `freezed_annotation ^3.1.0`
- ذخیره‌سازی: `flutter_secure_storage ^11.2.0` + `shared_preferences ^2.5.5`
- نقشه: `neshan_maps_flutter ^1.1.0` + `geolocator ^14.0.3` **(نشان، نه Google Maps)**
- UI: `cached_network_image`, `shimmer`, `fl_chart`
- فارسی: `parsi_datetime_picker ^0.0.2`, `text_fa`, `intl ^0.20.3`
- پوش: `firebase_core`, `firebase_messaging`, `flutter_local_notifications`
- کدتولیدی: `build_runner`, `freezed`, `json_serializable`, `retrofit_generator`, `riverpod_generator`

فایل barrel `lib\boya_shared.dart`:

```dart
export 'app/boya_app.dart';
export 'theme/boya_colors.dart';
export 'theme/boya_theme.dart';
export 'theme/boya_typography.dart';
export 'utils/jalali_date_utils.dart';
export 'utils/persian_number_utils.dart';
export 'utils/text_direction_utils.dart';
export 'widgets/boya_date_picker.dart';
export 'widgets/boya_logo.dart';

// خروجی انتخابی (فقط دو نام) تا با toPersianDigits خود boya_shared تداخل نکند:
export 'package:parsi_datetime_picker/parsi_datetime_picker.dart' show ParsiDate, showParsiDatePicker;
```

**نکات:**

- الگوی `show ParsiDate, showParsiDatePicker` یک تصمیم دقیق برای جلوگیری از **تداخل نام** با ویجت‌های خودی است — کد آگاهانه و درست.
- با این‌همه، فایل `beauty_shared.dart` **نیز وجود دارد** و کنار `boya_shared.dart` باقی مانده → **دو فایل barrel موازی** با نام‌گذاری متفاوت (`beauty` vs `boya`). این بدهی فنی است: کدام منبع حقیقت است؟
- پوشه‌های `lib\api`, `lib\models`, `lib\widgets` فقط `.gitkeep` دارند → **هیچ لایه API/مدل مشترکی وجود ندارد.** با اینکه `dio`/`retrofit`/`freezed` در `pubspec.yaml` آمده‌اند، هر اپ باید کلاینت خودش را بسازد. **این بزرگ‌ترین شکاف معماری موبایل است.**

### ۵.۱.۲ اپ سالن `mobile\salon_app\lib\main.dart`

```dart
ProviderContainer globalProviderContainer = ProviderContainer();

void main() {
  runApp(UncontrolledProviderScope(container: globalProviderContainer, child: const SalonApp()));
}

class SalonApp extends ConsumerWidget {
  Widget build(context, ref) => MaterialApp.router(
    title: 'بویا سالن',
    theme: BoyaTheme.light(),
    darkTheme: BoyaTheme.dark(),
    locale: const Locale('fa', 'IR'),
    supportedLocales: const [Locale('fa', 'IR'), Locale('en')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    builder: (context, child) => rtl(child ?? const SizedBox.shrink()),
    routerConfig: ref.watch(appRouterProvider),
  );
}
```

نقاط قوت:

- **پشتیبانی کامل RTL با `rtl(...)` wrapper** و `Locale('fa','IR')` — الزام بازار ایران به‌درستی رعایت شده.
- **`ProviderContainer` بیرون درخت ویجت** نگه داشته می‌شود با توضیح صریح: «تا `GoRouter.redirect` بتواند state احراز هویت را پیش از ساخت اولین صفحه بخواند.» این یک الگوی پیشرفته و درست Riverpod/GoRouter است.
- تم روشن/تاریک از `BoyaTheme`.

نکات:

- ساختار feature در `lib\features\`: `auth`, `bookings`, `dashboard`, `finance`, `portfolio`, `profile`, `salon`, `services`, `specialists` — **کامل‌ترین اپ از نظر دامنه**.
- پوشه `finance` در اپ سالن وجود دارد، ولی هیچ اندپوینت مالی فعالی در بک‌اند نیست (فاز ۱).

### ۵.۱.۳ بقیه اپ‌ها

| اپ | featureها | وضعیت |
| --- | --- | --- |
| `customer_app` | `auth`, `booking`, `home`, `notifications`, `profile`, `salon` | ✅ موجود؛ اپ با بیشترین داده در بک‌اند |
| `salon_app` | `auth`, `bookings`, `dashboard`, `finance`, `portfolio`, `profile`, `salon`, `services`, `specialists` | ✅ کامل‌ترین |
| `specialist_app` | `bookings`, `dashboard`, `profile`, `schedule` | ⚠️ **کم‌ترین پوشش — بدون `auth`** → اپ متخصص ظاهراً مسیر ورود خودش را ندارد |

**شکاف مهم:** `specialist_app` پوشه `auth` ندارد، در حالی که بک‌اند نقش `specialist` را می‌شناسد و آن‌ها را در `APPROVER_ROLES` می‌آورد. بخش ۰۳ (B5) نشان می‌دهد که یک متخصص **می‌تواند** رزروها را تأیید کند ولی اپ او ظاهراً راهی برای ورود ندارد. **پرسش مشاور: آیا اپ متخصص در این فاز پشتیبانی نمی‌شود؟**

> **به‌روزرسانی 2026-10-05 (پاسخ به پرسش بالا):** خیر — اپ متخصص پشتیبانی نمی‌شود.
> `mobile/specialist_app` طبق **ADR-003** حذف شد و نقش `specialist` به `salon_app` سپرده شد.
> توجه: شکاف «مسیر ورود متخصص» با حذف اپ **حل نشد** — `salon_app` هیچ route guard مبتنی بر
> نقش ندارد (فقط `isAuthenticated`)، پس حساب متخصص امروز کل UI سالن‌دار را می‌بیند.
> این شکاف در `BACKLOG.md` (فاز ۲) ثبت شده و باید پیش از عرضه بسته شود.

---

## ۵.۲ لایه تست بک‌اند — تصویر کامل

> **اصلاح یک فرض غلط رایج:** برخلاف آنچه ممکن است از یک نگاه سطحی به `src` به‌نظر برسد، پروژه **تست‌های integration واقعی با Postgres دارد**. آن‌ها زیر `backend\test\` هستند، نه `src\`.

### ۵.۲.۱ تست‌های unit (`src\**\*.spec.ts`, اجرا با `npm test` = `jest --passWithNoTests`)

| فایل | موضوع |
| --- | --- |
| `src\modules\auth\otp.service.spec.ts` | OTP: نرمال‌سازی، rate limit، hash، TTL |
| `src\modules\common\jalali-date.service.spec.ts` | سرویس تاریخ جلالی |
| `src\modules\salon\salon.service.spec.ts` | `isSalonOpenNow` — ۹ سناریو |
| `src\utils\jalali-date.util.spec.ts` | util تاریخ |
| `src\utils\persian-number.util.spec.ts` | تبدیل ارقام فارسی/لاتین |
| `src\utils\working-hours.util.spec.ts` | ساعات کاری |

### ۵.۲.۲ تست‌های e2e (`backend\test\`, اجرا با `npm run test:e2e`)

اسکریپت `test:e2e` ابتدا `tsc -p tsconfig.test.json` می‌زند و سپس **فایل‌های کامپایل‌شده در `dist-test\test\` را با `node --test` اجرا می‌کند** (نه Jest):

```
auth.e2e-spec.js, otp.service.spec.js, availability.service.spec.js,
cancellation-policy.service.spec.js, in-app-notification.service.spec.js,
referral-code.service.spec.js, loyalty-point.service.spec.js
```

فایل‌های موجود در `backend\test\`: `app.e2e-spec.ts`, `auth.e2e-spec.ts`, `availability.service.spec.ts`, `cancellation-policy.service.spec.ts`, `in-app-notification.service.spec.ts`, `loyalty-point.service.spec.ts`, `otp.service.spec.ts`, `redis-otp.storage.spec.ts`, `referral-code.service.spec.ts`.

> **نکته:** `redis-otp.storage.spec.ts` **در لیست `test:e2e` نیست** → یک فایل تست که هرگز در CI اجرا نمی‌شود.

### ۵.۲.۳ تست‌های Integration — وجود دارند و مهم‌اند

اجرا با `npm run test:integration` (`jest --config ./test/jest-integration.json`). این اسکریپت:

```json
{
  "rootDir": "..",
  "testRegex": "test/integration/.*\\.integration-spec\\.ts$",
  "globalSetup": "<rootDir>/test/setup/global-setup.ts",
  "setupFilesAfterEnv": ["<rootDir>/test/setup/integration.setup.ts"],
  "testTimeout": 30000
}
```

سه اسپک integration:

| فایل | چه چیزی را اثبات می‌کند |
| --- | --- |
| `booking-exclusion.integration-spec.ts` | دو `INSERT` هم‌زمان هم‌پوشان → **دقیقاً یکی** موفق می‌شود و دیگری `23P01` می‌گیرد؛ در پایان `count = 1` |
| `rls-isolation.integration-spec.ts` | tenant A ردیف tenant B را **نمی‌بیند** (`n = 0`) و `WITH CHECK` جلوی `INSERT` cross-tenant را می‌گیرد (`/row-level security/i`) |
| `policy-guc.integration-spec.ts` | از `pg_policies` می‌خواند: هر ۵ سیاست `tenant_id` روی **`app.current_tenant_id`** هستند و `qual`/`with_check` **هرگز `app.tenant_id` ندارند** |

**این‌ها تست‌های باکیفیت و هدف‌مند هستند.** نکات قابل توجه:

- `booking-exclusion` از `Promise.allSettled` استفاده می‌کند تا **هم‌روندی واقعی** را بسنجد — نه یک تست توالی.
- `rls-isolation` صریحاً می‌گوید «superuser همه سیاست‌ها را bypass می‌کند، پس هرگز برای assertions استفاده نمی‌شود» → از نقش `beauty_app` با `NOBYPASSRLS` استفاده می‌کند. **این دقیقاً تست درست است.**
- `policy-guc` **ریسک B12/مهاجرت ۲۷ را مستقیم پوشش می‌دهد**: اگر کسی سیاست‌ها را به `app.tenant_id` برگرداند، این تست می‌شکند. تور امنیتی بسیار خوبی است.
- `integration.setup.ts` وقتی Postgres در دسترس نیست **skip** می‌کند (با `describeIntegration = describe.skip`) تا `npm test` روی لپ‌تاپ بدون داکر سبز بماند.

**ریسک واقعی این طراحی:** `describe.skip` در CI به‌معنای **سبز بی‌مفهوم** است. اگر workflow بک‌اند به Postgres متصل نشود، تست‌های integration بی‌صدا رد می‌شوند و CI همچنان سبز است. **پرسش مشاور: آیا تست‌های integration در CI با سرویس Postgres واقعاً اجرا می‌شوند؟** (بخش ۵.۴ نشان می‌دهد که اجرا **نمی‌شوند**.)

---

## ۵.۳ تست‌های Flutter

### ۵.۳.۱ فایل‌های تست موجود

| مسیر | موضوع |
| --- | --- |
| `mobile\customer_app\test\booking_flow_test.dart` | جریان رزرو مشتری |
| `mobile\customer_app\test\notifications_screen_test.dart` | صفحه اعلان‌ها |
| `mobile\customer_app\test\widget_test.dart` | boot اپ + feed فارسی |
| `mobile\salon_app\test\salon_status_test.dart` | وضعیت سالن |
| `mobile\shared\test\boya_app_test.dart` | پوسته اپ مشترک |
| `mobile\shared\test\jalali_date_utils_test.dart` | util تاریخ جلالی |
| `mobile\shared\test\persian_number_utils_test.dart` | util ارقام فارسی |

**هیچ تستی برای `specialist_app` وجود ندارد.**

### ۵.۳.۲ خطای شناخته‌شده: `widget_test.dart` در `customer_app`

از `mobile\customer_app\analyze_baseline.txt`:

```
error - The name 'MyApp' isn't a class. Try correcting the name to match an existing class
        - test\widget_test.dart:16:35 - creation_with_non_type

1 issue found. (ran in 3.5s)
```

اما مقایسه با **محتوای فعلی** `mobile\customer_app\test\widget_test.dart` نشان می‌دهد که فایل **بازنویسی شده** و دیگر `MyApp` را ارجاع نمی‌دهد:

```dart
testWidgets('customer app boots to the Persian home feed', (tester) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        nearbySalonsProvider.overrideWith((ref) async => const <SalonSummary>[]),
        homeCategoriesProvider.overrideWith((ref) async => const <ServiceCategory>[]),
      ],
      child: const CustomerApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.drag(find.byType(ListView).first, const Offset(0, -400));
  await tester.pumpAndSettle();
  expect(find.text('سالن‌های اطراف شما'), findsOneWidget);
  expect(find.text('۲۰٪ تخفیف اولین رزرو'), findsOneWidget);
  expect(Directionality.of(tester.element(find.text('سالن‌های اطراف شما'))), TextDirection.rtl);
});
```

**نتیجه:** `analyze_baseline.txt` یک **snapshot قدیمی** است و مشکل `MyApp` **حل شده**. تست جدید بسیار بهتر است:

- شبکه را با `overrideWith` خالی می‌کند → **بدون تماس شبکه** (شبکه در تست = ناپایداری).
- `SharedPreferences.setMockInitialValues({})` را ست می‌کند و دلیلش را در کامنت توضیح می‌دهد: «کنترل‌کننده احراز هویت نشست کش‌شده را از دیسک بازیابی می‌کند؛ بدون store در حافظه، کانال پلاگین هرگز پاسخ نمی‌دهد و splash تمام نمی‌شود.»
- **RTL را به‌طور صریح assert می‌کند:** `expect(Directionality.of(...), TextDirection.rtl)`.
- هدر را اسکرول می‌کند چون «بزرگ‌تر از viewport 600 پیکسلی تست است» — توجه به جزئیات محیط تست.

> **اکشن پیشنهادی:** `analyze_baseline.txt` باید حذف یا دوباره تولید شود؛ نگه‌داشتن یک baseline کهنه، گزارش وضعیت را گمراه می‌کند.

### ۵.۳.۳ شکاف‌های تست موبایل

- **هیچ تست integration/widget برای `salon_app`** به‌جز یک تست وضعیت سالن.
- **هیچ تستی برای `specialist_app`.**
- هیچ تستی برای لایه شبکه/Auth (چون لایه مشترک API وجود ندارد).
- CI موبایل فقط `flutter analyze` می‌زند (**نه `flutter test`**) — بخش ۵.۴.

---

## ۵.۴ CI/CD — تحلیل دو workflow

### ۵.۴.۱ `.github\workflows\backend.yml`

```yaml
name: Backend
on:
  push: { paths: ["backend/**", ".github/workflows/backend.yml"] }
  pull_request: { paths: ["backend/**", ".github/workflows/backend.yml"] }
jobs:
  test:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
      - run: npm run build
      - run: npm test
```

**شکاف‌های بحرانی:**

1. **`npm run test:integration` اجرا نمی‌شود.** هیچ سرویس PostgreSQL در workflow تعریف نشده → سه اسپک integration هرگز در CI اجرا نمی‌شوند. یعنی محافظ Exclusion/RLS/GUC **در CI تست نمی‌شود**؛ فقط روی لپ‌تاپ توسعه‌دهنده‌ای که داکر دارد.
2. **`npm run test:e2e` اجرا نمی‌شود.** تست‌های e2e (auth, availability, cancellation-policy, …) در CI هیچ‌وقت اجرا نمی‌شوند.
3. **`npm run lint` اجرا نمی‌شود.** هرچند اسکریپت `lint` با `--max-warnings 0` سخت‌گیرانه تعریف شده، در CI نیست.
4. **بدون سرویس Redis.** تست‌های OTP به Redis نیاز دارند.

**ترکیب پیامد ۱ و `describe.skip` از بخش ۵.۲.۳:** اگر روزی کسی Integration CI را اضافه کند و Postgres در دسترس نباشد، تست‌ها **سبز** رد می‌شوند. برای همین باید `integrationEnabled` در CI به‌صورت **fail** رفتار کند، نه skip.

### ۵.۴.۲ `.github\workflows\mobile.yml`

```yaml
jobs:
  analyze:
    strategy:
      matrix:
        package: [mobile/shared, mobile/customer_app, mobile/salon_app, mobile/specialist_app]
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { channel: stable }
      - run: flutter pub get       (working-directory: ${{ matrix.package }})
      - run: flutter analyze       (working-directory: ${{ matrix.package }})
```

نقاط قوت:

- **matrix روی هر چهار پکیج** — خوب.

شکاف‌ها:

1. **`flutter test` اجرا نمی‌شود.** هفت فایل تست Flutter وجود دارد ولی CI آن‌ها را اجرا نمی‌کند. تحلیل ایستا جای تست رفتاری را نمی‌گیرد.
2. **`flutter build` اجرا نمی‌شود** → خرابی‌های build (مثلاً ناسازگاری نسخه) تا انتشار کشف نمی‌شوند.
3. **بدون pin نسخه Flutter:** `channel: stable` یعنی یک نسخه جدید Flutter می‌تواند CI را بدون تغییر کد بشکند. **تکرارپذیری CI پایین.**
4. هیچ job انتشار/امضا وجود ندارد.
5. هیچ artifact/golden test screenshot وجود ندارد.

### ۵.۴.۳ جدول خلاصه CI

| سنجه | Backend | Mobile |
| --- | --- | --- |
| build | ✅ | ❌ |
| unit test | ✅ (`npm test`) | ❌ |
| e2e test | ❌ | ❌ |
| integration test | ❌ | ❌ |
| analyze/lint | ❌ (`lint` وجود دارد ولی اجرا نمی‌شود) | ✅ (`flutter analyze`) |
| سرویس Postgres | ❌ | — |
| سرویس Redis | ❌ | — |
| pin شدن نسخه | ✅ Node 22 | ❌ (`stable`) |

---

## ۵.۵ استقرار

### ۵.۵.۱ Docker

تنها محتوای `docker\` یک فایل است: `docker\postgres\init\01-roles.sql` (محتوا در بخش ۰۲.۷).

**شکاف‌ها:**

- **`Dockerfile` برای بک‌اند وجود ندارد.**
- **`docker-compose.yml` وجود ندارد.** با اینکه `README.md` از compose صحبت می‌کند، فایلش نیست.
- فایل init فقط نقش `beauty_app` را با رمز **ثابت `app_password_dev`** می‌سازد.

### ۵.۵.۲ اسکریپت‌های اجرا (`backend\package.json`)

```json
"build": "nest build",
"start:dev": "nest start --watch",
"start:prod": "node dist/main.js",
"lint": "eslint \"{src,test}/**/*.ts\" --max-warnings 0",
"test": "jest --passWithNoTests",
"test:e2e": "tsc -p tsconfig.test.json && node --test dist-test/test/...",
"test:integration": "jest --config ./test/jest-integration.json",
"migration:run" / "migration:revert" / "migration:show" / "migration:generate"
```

- `engines.node: ">=20"` در `package.json`، ولی CI از Node 22 استفاده می‌کند (چون `firebase-admin 14` نیازمند Node 22+ است). **ناسازگاری جزئی:** `>=20` گمراه‌کننده است؛ باید `>=22` می‌بود.
- `start:prod` به `dist/main.js` اشاره می‌کند — استاندارد Nest.

### ۵.۵.۳ چک‌لیست استقرار (وضعیت فعلی)

| مورد | وضعیت |
| --- | --- |
| Dockerfile بک‌اند | ❌ وجود ندارد |
| docker-compose | ❌ وجود ندارد |
| مهاجرت‌های شماره‌دار و بازگشت‌پذیر | ✅ کامل (۲۷ فایل) |
| جداسازی نقش migration از runtime | ✅ `data-source.migration.ts` |
| مدیریت سکرت | ⚠️ رمز dev در کد |
| pin نسخه Node در CI | ✅ |
| pin نسخه Flutter در CI | ❌ |
| استقرار خودکار | ❌ |

---

## ۵.۶ فهرست کامل باگ‌ها و ریسک‌ها (تجمیع بخش‌های ۰۲–۰۵)

### ۵.۶.۱ باگ‌های تأییدشده (کد را دیده‌ام، رفتار اشتباه است)

| # | باگ | فایل | اثر |
| --- | --- | --- | --- |
| **BUG-1** | JOIN `users → tenants` در `notify()` هرگز برای مشتری ردیفی برنمی‌گرداند، چون `users.tenant_id` برای مشتری `NULL` است | `reminder.scheduler.ts` | **SMS یادآوری برای هیچ مشتری‌ای ارسال نمی‌شود.** push و اعلان درون‌برنامه‌ای کار می‌کنند، پس باگ بی‌صدا است |
| **BUG-2** | `markRefundPending` بدون `dataSource.transaction`؛ `bookings.cancel` **قبل از** `provider.refund` اجرا می‌شود | `payment.service.ts` | اگر refund خطا بدهد، رزرو `cancelled` می‌ماند ولی پول برنمی‌گردد و هیچ رکورد خطایی نیست |
| **BUG-3** | `provider.refund()` هیچ تماس شبکه‌ای ندارد؛ فقط `warn` + `providerRefundId: 'manual-*'` | `zarinpal-payment.provider.ts` | تراکنش `refunded` ثبت می‌شود در حالی که **هیچ پولی جابه‌جا نشده** |
| **BUG-4** | `findById`, `cancel`, `markReviewed` بدون `setTenantContext` روی جدول تحت `FORCE RLS` | `booking.service.ts` | تحت RLS فعال، خواندن‌ها **صفر ردیف** → `NotFoundException` نادرست |
| **BUG-5** | `confirmVisitByCustomer` بدون `setTenantContext` | `booking.service.ts` | مشتری **نمی‌تواند** جلوی sweep no-show را بگیرد → جریمه نادرست |
| **BUG-6** | `POST /payments/initiate` مقدار `tenantId` را از **بدنه درخواست** می‌گیرد، نه از توکن | `payment.controller.ts` | یک کاربر احرازشده می‌تواند `tenantId` هر سالنی را بفرستد (آماده فاز ۲) |
| **BUG-7** | `redis-otp.storage.spec.ts` در اسکریپت `test:e2e` نیست | `package.json` | یک فایل تست هرگز اجرا نمی‌شود |
| **BUG-8** | نام نقش در `1730000000006` = `boya_app` ولی در همه‌جای دیگر = `beauty_app` | مهاجرت‌ها | احتمالاً GRANT/REVOKE ناهم‌راستا |

### ۵.۶.۲ ریسک‌های ساختاری

| # | ریسک | اثر |
| --- | --- | --- |
| **RISK-1** | CI هیچ integration test اجرا نمی‌کند | محافظ Exclusion/RLS/GUC فقط دستی تست می‌شود |
| **RISK-2** | `describe.skip` وقتی Postgres در دسترس نیست = سبز بی‌مفهوم | CI می‌تواند بدون هیچ تست واقعی سبز باشد |
| **RISK-3** | CI موبایل `flutter test` اجرا نمی‌کند | ۷ فایل تست بدون اجرا می‌مانند |
| **RISK-4** | دو پیاده‌سازی نرمال‌سازی شماره | ثبت‌نام/ورود با فرمت‌های مختلف می‌تواند رکورد متفاوت بسازد |
| **RISK-5** | لایه API/مدل مشترک Flutter خالی است | `dio`/`retrofit`/`freezed` بلااستفاده می‌مانند؛ سه بار تکرار کد |
| **RISK-6** | `specialist_app` بدون `auth` | متخصص نمی‌تواند وارد شود |
| **RISK-7** | Stripe در مستندات/env، Zarinpal در کد | گمراهی مشاور؛ بوت شکست‌خورد بی‌دلیل با نبود `STRIPE_SECRET_KEY` |
| **RISK-8** | `analyze_baseline.txt` کهنه | گزارش وضعیت گمراه‌کننده |
| **RISK-9** | Dockerfile/compose وجود ندارد | استقرار تکرارپذیر نیست |
| **RISK-10** | رمز `app_password_dev` در کد | ریسک امنیتی در محیط واقعی |
| **RISK-11** | نسخه Flutter در CI pin نشده | شکست ناگهانی CI |
| **RISK-12** | مهاجرت ۲۷ غیرقابل بازگشت | rollback نیازمند مهاجرت جدید است |
| **RISK-13** | گام اسلات ثابت ۳۰ دقیقه | هدر رفتن ظرفیت برای خدمات کوتاه |
| **RISK-14** | صفحه `web\` خالی | ادعای «ویترین وب» پشتوانه ندارد |

---

## ۵.۷ پرسش‌های کلیدی برای مشاور

1. **بازپرداخت واقعی:** آیا هدف فاز دوم تسویه خودکار با Zarinpal است؟ آیا باید صف/cron بازپرداخت ساخته شود یا دخالت دستی قابل قبول است؟
2. **تناقض Stripe/Zarinpal:** آیا `stripe` باید از `package.json` و `env.validation.ts` حذف شود، یا Stripe Connect واقعاً در برنامه فاز ۲ است؟
3. **تقسیم درآمد:** آیا `salonShare = total - specialistShare` درست است، یا `platformFee` باید از سهم سالن کسر شود؟ منشور می‌گوید پلتفرم درآمد تقسیم نمی‌کند — این متناقض است.
4. **مدل جریمه (no-show):** جریمه ۱۰۰٪ در `no_show` در فاز ۱ غیرقابل‌اجرا است (پرداخت آنلاین خاموش). آیا باید سیاست دیگری (مثلاً محدودیت تعداد رزرو همزمان) جایگزین شود؟
5. **no-show grace:** آیا ۳۰ دقیقه درست است، یا باید بر اساس مدت خدمت/نوع سالن متفاوت باشد؟
6. **B5:** آیا متخصص باید فقط رزروهای خودش را ببیند یا همه رزروهای سالن؟
7. **مهاجرت ۲۷:** در staging/prod اجرا شده است؟ (اگر نه، داده tenant‌محور بی‌صدا صفر می‌شود.)
8. **CI integration:** آیا باید سرویس Postgres به `backend.yml` اضافه شود و `integrationEnabled` در CI به‌جای skip، **fail** کند؟
9. **نقشه:** استفاده از **نشان (Neshan)** به‌جای Google Maps تأیید شده است؟
10. **`web\`:** آیا سایت وب بازاریابی در دامنه فاز ۱ است یا خیر؟ (الان فقط README دارد.)
11. **اپ متخصص:** آیا `specialist_app` در فاز ۱ پشتیبانی می‌شود؟ (بدون `auth`.)
12. **لایه API مشترک Flutter:** آیا باید الان ساخته شود تا `dio`/`retrofit`/`freezed` در `shared` به‌کار بیفتند؟
13. **رمز `app_password_dev`:** برنامه مدیریت سکرت در محیط واقعی چیست؟
14. **هاست/زیرساخت:** Redis و Postgres در محیط واقعی از کجا تأمین می‌شوند؟ compose فعلی وجود ندارد.

---

## ۵.۸ جمع‌بندی نهایی

**آنچه خوب کار می‌کند:**

- مدل امنیتی چندمستأجری: RLS + `FORCE` + `NOBYPASSRLS` + الگوی توابع `SECURITY DEFINER` برای خروج امن — طراحی بالغ و درست.
- Exclusion Constraint به‌صورت جزئی، با تبدیل درست `23P01`/`40P01` به `ConflictException`.
- OTP: hash با pepper + timing-safe compare + rate limit دوطرفه.
- idempotency پرداخت: PK روی `event_id` + UNIQUE روی `booking_id` + بررسی `captured` (سه لایه).
- تست‌های integration هدف‌مند که دقیقاً ریسک‌های RLS/Exclusion/GUC را می‌سنجند.
- RTL کامل و بومی‌سازی فارسی/جلالی در موبایل.
- مستندسازی درون‌خطی استثنایی — تصمیم‌ها همراه با دلیل نوشته شده‌اند.
- جداسازی نقش migration از نقش runtime و `synchronize: false`.

**آنچه باید پیش از فاز دوم حل شود:**

- BUG-1 تا BUG-6 (به‌ویژه بازپرداخت و `tenantId` از بدنه).
- RISK-1 تا RISK-3 (CI واقعاً تست اجرا کند).
- RISK-7 (تکلیف Stripe/Zarinpal روشن شود).
- طراحی صف تسویه بازپرداخت.
- استقرار تکرارپذیر (Dockerfile + compose).
- لایه API مشترک Flutter.

**آنچه وجود ندارد (صریح):**

- Stripe / Stripe Connect / Split Payments — ❌ **وجود ندارد**
- escrow — ❌ **وجود ندارد**
- پرداخت آنلاین فعال — ❌ **وجود ندارد** (`PAYMENTS_ENABLED=false`)
- بازپرداخت واقعی — ❌ **وجود ندارد** (فقط `manual-` id)
- تسویه خودکار متخصص — ❌ **وجود ندارد**
- صف BullMQ فعال — ❌ **وجود ندارد** (پکیج `@nestjs/bull` در `package.json` هست ولی هیچ صف/پروسوری در `src` ثبت نشده)
- CLS/AsyncLocalStorage برای tenant context — ❌ **وجود ندارد** (`nestjs-cls` در `package.json` هست ولی `setTenantContext` مستقیم `set_config` می‌زند)
- سطح ایزولاسیون SERIALIZABLE/REPEATABLE READ — ❌ **وجود ندارد** (پیش‌فرض Postgres = READ COMMITTED)
- سایت `web\` — ❌ **وجود ندارد** (فقط `README.md`)
- Dockerfile / compose — ❌ **وجود ندارد**
- اپ متخصص با ورود — ❌ **ناقص**

---

_پایان گزارش بخش ۰۵ — برای فهرست کامل به `00-index.md` مراجعه کنید._





