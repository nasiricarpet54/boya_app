# Beauty Platform

Multi-tenant marketplace for beauty salons. NestJS API plus three Flutter apps (customer, salon, specialist) that share one Dart package.

## Workspace

The whole BOYA platform lives in one root and must stay there:

```
E:\BOYA platform
```

Do not split backend, mobile apps, design system, or CI config into another directory. New code, docs, and config belong under this root.

## Layout

```
.github/copilot-instructions.md
backend/                 NestJS 11 API
  src/common/            decorators, filters, guards, interceptors, pipes
  src/config/
  src/database/          migrations, seeds
  src/modules/           auth, tenant, user, specialist, service,
                         booking, payment, notification, admin, referral
  src/utils/             Jalali dates and Persian numerals
mobile/shared/           Shared Flutter package (theme, utils, localization)
mobile/customer_app/     Customer app (بویا)
mobile/salon_app/        Salon panel (also serves the `specialist` role)
web/                     Test-only web panels (not the primary product)
  customer/              Browser stand-in for the customer app
  salon/                 Browser stand-in for the salon app
  specialist/            Browser stand-in for the specialist app
design_system/           BOYA design tokens
docker-compose.yml
```

## Backend

Requires Node.js 20+ and the Postgres/Redis stack below.

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

Swagger UI: `http://localhost:3000/docs`. API prefix: `/api/v1`.

`synchronize` is off. Add TypeORM migrations under `src/database/migrations` instead of auto-syncing the schema. Tenant-scoped tables need `tenant_id` and row-level security; see `.github/copilot-instructions.md`.

## Data stores

```bash
docker compose up -d
```

Postgres 16 on host port 5433 and Redis 7 on host port 6380 (see `docker-compose.yml`, the single source of ports). The compose file uses the placeholder password `change-me`. Change it before any shared environment, and keep the same value in `backend/.env`.

## Mobile

Flutter stable (SDK `^3.12`, Flutter `>=3.44`) is required by the pinned pub packages.

```bash
cd mobile/shared && flutter pub get
cd ../customer_app && flutter pub get && flutter run
```

Repeat `flutter pub get` in `salon_app`. There is no separate specialist app: the
`specialist` role is served by `salon_app` (see ADR-003).

## Web panels (test only)

The apps stay the product. `web/` is only a browser stand-in so each panel can be clicked through without an emulator:

| Panel | App it mirrors | Local URL |
| --- | --- | --- |
| Customer | `mobile/customer_app` | `http://localhost:3001` |
| Salon | `mobile/salon_app` | `http://localhost:3002` |
| Specialist | `mobile/salon_app` (role-based) | `http://localhost:3002` |

Same API (`http://localhost:3000/api/v1`), same Persian/RTL/Jalali rules. No login is seeded yet, so these URLs do not open until the panels are built. Do not put business logic here that the apps do not have.

## Integrations

Credentials live only in `backend/.env` (see `.env.example`). Nothing secret is committed.

| Concern | Package | Notes |
| --- | --- | --- |
| Tenant context | `nestjs-cls` 6.2.0 | Official CLS module. `@nestjs/cls` does not exist. |
| Payments | `stripe` 22.6.2 | Stripe Connect split payments. Wrap it in `PaymentService`. `@ciphercross/nestjs-stripe` is not used: it pins `stripe@14`, which conflicts with the SDK already wired here. |
| SMS | `@mirad-work/sms-nestjs` 0.5.0 + `@mirad-work/sms-core` 0.5.1 | Kavenegar through `NotificationService`. Persian templates only. |
| Push | `firebase-admin` 14.5.0 | Requires Node 22+. Credentials stay in `backend/.env`. |
| Jobs | `@nestjs/bull` 12.0.0 + `bull` 4.16.5 | Redis-backed queues. |
| Schedule | `@nestjs/schedule` 12.0.2 | Cron jobs. Peers accept Nest 11 and 12. |
| Access control | `@jeonghochoi/rbac` 0.1.7 | Optional multi-tenant RBAC. Peers require Nest 11. |
| Dates | `date-fns-jalali` 4.4.0-0 | Display conversion only. Instants stay UTC. Tehran civil date is passed in as a wall clock because the library has no timezone. |
| Maps | `neshan_maps_flutter` 1.1.0 | Used from `mobile/shared`. |
| Cache | `@nestjs/cache-manager` 3.1.0 + `@keyv/redis` 5.1.6 | `cache-manager-redis-yet` targets cache-manager 5 and is not used. |

Nest stays on the 11 line (`@nestjs/common` / `@nestjs/core` 11.1.6). Nest 12 is current `latest` but is not wired here.

## Decisions & AI rules

- [`DECISIONS.md`](DECISIONS.md) — short ADRs for the standing architecture decisions (tenant GUC, Redis split, three-app maintenance, payments, users RLS, test order).
- [`.cursorrules`](.cursorrules) — fixed rules every AI assistant in this repo must follow (multi-tenancy, security, database, code style, workflow, forbidden stack).
