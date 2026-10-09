# BOYA — پلتفرم جامع خدمات زیبایی

پلتفرم دو‑طرفه (two-sided) برای خدمات زیبایی: مشتری‌ها سالن و متخصص پیدا می‌کنند و رزرو می‌کنند؛ سالندارها و متخصصین مستقل پنل مدیریت خودشان را دارند.

**وضعیت:** Phase 1 (ویترین رایگان) — در حال آماده‌سازی برای بتا

---

## 📱 اجزای پروژه

| بخش | فناوری | توضیح |
|-----|--------|-------|
| **Backend** | NestJS 11 + PostgreSQL 16 + TypeORM | API مرکزی، RLS چند‑مستأجری، prefix `/api/v1` |
| **Admin Panel** | Next.js 14 | پنل مدیریت پلتفرم (invite، approve) |
| **Customer App** | Flutter 3.47 | اپ مشتری (iOS/Android/Web) |
| **Salon App** | Flutter 3.47 | پنل سالندار و متخصص |
| **Shared** | Flutter package | تم، مدل، API client مشترک |

> اپ جداگانهٔ `specialist_app` حذف شد و نقش specialist با route guard مبتنی بر نقش در `salon_app` سرو می‌شود ([ADR-003](DECISIONS.md)).

---

## 🏗️ معماری

### Multi-Tenancy با RLS
- همهٔ جداول tenant-scoped با `FORCE ROW LEVEL SECURITY`
- GUC استاندارد: `app.current_tenant_id` ([ADR-001](DECISIONS.md))
- `SECURITY DEFINER` برای cron و cross-tenant access ([ADR-007](DECISIONS.md))
- اپ با نقش `beauty_app` (بدون BYPASSRLS) و migrationها با کاربر master (`beauty`) اجرا می‌شوند

### امنیت
- JWT access (15m) + refresh (7d) با rotation و reuse detection ([ADR-009](DECISIONS.md))
- Invite tokens با SHA-256 (توکن خام هرگز persist نمی‌شود) ([ADR-010](DECISIONS.md))
- `RolesGuard` برای کنترل نقش ([ADR-008](DECISIONS.md))
- Exclusion Constraint برای جلوگیری از double-booking

### Booking
- `tstzrange` + GiST برای همپوشانی زمان
- کدهای خطای `23P01` (exclusion violation) و `40P01` (deadlock) هر دو handle می‌شوند
- Scheduler: `claimDue` و `detectNoShows` با الگوی `SECURITY DEFINER`

### پرداخت (غیرفعال در Phase 1)
- ویترین رایگان: `PAYMENTS_ENABLED=false` و هر endpoint پرداخت با `503` پاسخ می‌دهد ([ADR-004](DECISIONS.md))
- درگاه سیم‌کشی‌شده در درخت کد: **Zarinpal** (نه Stripe)

---

## 📁 ساختار مخزن

```
backend/                    NestJS 11 API
  src/database/             migrations (synchronize خاموش است)
  src/modules/              auth, tenant, user, specialist, service,
                            booking, payment, notification, health, admin, referral
  src/utils/                تاریخ جلالی و ارقام فارسی
mobile/shared/              پکیج Flutter مشترک (theme, models, API client)
mobile/customer_app/        اپ مشتری (بویا)
mobile/salon_app/           پنل سالندار و متخصص
admin-panel/                پنل مدیریت (Next.js 14)
docker/                     اسکریپت init پستگرس
docker-compose.yml          استک dev (فقط Postgres + Redis)
docker-compose.staging.yml  استک کامل staging (Postgres+Redis+backend+Caddy)
Caddyfile                   reverse proxy برای staging
DECISIONS.md                ADRها (تصمیم‌های معماری)
BACKLOG.md                  کارهای باز و برنامهٔ استقرار
```

> کل پلتفرم در یک ریشه (`E:\BOYA platform`) زندگی می‌کند و نباید split شود.

---

## 🚀 اجرا

### پیش‌نیازها
- Node.js 20+ (برای push از `firebase-admin` به 22+ نیاز است)
- Docker Desktop
- Flutter 3.44+ / stable (برای موبایل)

### ۱) دیتابیس و کش (dev)

```bash
docker compose up -d
# Postgres 16 روی 5433 و Redis 7 روی 6380 (docker-compose.yml منبع واحد پورت)
```

### ۲) Backend (لوکال)

```bash
cd backend
cp .env.example .env     # سپس مقادیر را ویرایش کنید
npm install
npm run start:dev        # http://localhost:3000 — Swagger روی /docs
```

`synchronize` خاموش است؛ schema فقط با TypeORM migration تغییر می‌کند (`npm run migration:run`).

### ۳) Staging کامل (SMS/OTP واقعی از طریق Kavenegar)

```bash
# ۱. کلون
git clone https://github.com/nasiricarpet/boya.git
cd boya

# ۲. secrets سراسری در .env ریشه (gitignore شده) — برای staging الزامی است:
#    دست‌کم JWT_ACCESS_SECRET، JWT_REFRESH_SECRET، KAVENEGAR_API_KEY، OTP_PEPPER

# ۳. env بک‌اند
cp backend/.env.example backend/.env

# ۴. اجرای استک (migration خودکار قبل از بالا آمدن backend اجرا می‌شود)
docker compose -f docker-compose.staging.yml up -d --build

# ۵. در صورت نیاز، اجرای دستی migration
docker compose -f docker-compose.staging.yml run --rm backend-migrate

# ۶. تأیید سلامت
curl http://localhost:3001/api/v1/health
```

### ۴) Admin Panel

```bash
cd admin-panel
npm install
npm run dev            # Next.js 14 — http://localhost:3001
```

> `admin-panel` (dev) و `backend` staging هر دو روی پورت 3001 می‌نشینند؛ همزمان اجرا نکنید.

### ۵) اپ‌های موبایل (Flutter)

```bash
cd mobile/shared    && flutter pub get
cd ../customer_app  && flutter pub get && flutter run
cd ../salon_app     && flutter pub get && flutter run
```

---

## 🔌 پورت‌ها و endpointها

| سرویس | dev (`docker-compose.yml`) | staging (`docker-compose.staging.yml`) |
|-------|----------------------------|-----------------------------------------|
| Backend (NestJS) | `3000` (اجرای محلی) | `3001 → 3000` |
| PostgreSQL | `5433 → 5432` | `5434 → 5432` |
| Redis | `6380 → 6379` | `6381 → 6379` |
| Caddy | — | `80`, `443` |

- API prefix: `/api/v1`
- Swagger UI: `/docs`
- Health: `/api/v1/health` (staging: `http://localhost:3001/api/v1/health`)

---

## ⚙️ پیکربندی (.env)

- **dev:** `backend/.env` (الگو: `backend/.env.example`)
- **staging:** `.env` در ریشهٔ repo (gitignore شده) — secrets سراسری

متغیرهای کلیدی: `DATABASE_*`، `REDIS_*`، `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`، `OTP_PEPPER`، `KAVENEGAR_API_KEY`، `INVITE_BASE_URL`، `CORS_ORIGINS`، `PAYMENTS_ENABLED`. هیچ secretی commit نمی‌شود.

---

## 🧪 تست و lint

```bash
# Backend
cd backend
npm run lint              # ESLint با max-warnings 0
npm test                  # unit
npm run test:integration  # با DB واقعی
npm run test:e2e

# Admin Panel
cd admin-panel && npm run typecheck

# Flutter
cd mobile/customer_app && flutter test
```

---

## 🚢 استقرار روی سرور production

پورت‌های 3000–3020 روی سرور مقصد اشغال است (پروژهٔ دیگر روی Docker). برنامهٔ کامل پورت‌ها — backend → 3021، و Postgres (5434) و Redis (6382) فقط داخلی و بدون expose — در [BACKLOG.md](BACKLOG.md) ثبت شده است.

---

## 🧭 قوانین و تصمیم‌ها

- [`DECISIONS.md`](DECISIONS.md) — ADRهای کوتاه (tenant GUC، Redis split، three-app، payments، RLS کاربران، test order، SECURITY DEFINER و…)
- [`PROJECT_CHARTER.md`](PROJECT_CHARTER.md) — چارچوب محصول و فازها
- [`BACKLOG.md`](BACKLOG.md) — کارهای باز، شکاف‌های امنیتی، برنامهٔ استقرار
- [`.cursorrules`](.cursorrules) و [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — قوانین ثابت برای هر دستیار AI در این repo (چند‑مستأجری، امنیت، دیتابیس، استایل کد، workflow)