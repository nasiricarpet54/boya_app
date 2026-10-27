# Beauty Platform — Project Instructions

## Project Overview
Multi-tenant, location-based beauty services marketplace (salons, line managers, independent specialists, customers).

## Critical Architecture Rules (Non-Negotiable)
- **Multi-Tenancy**: Every table MUST have `tenant_id`. Every query MUST filter by `tenant_id`. RLS MUST be enabled on all tenant-scoped tables.
- **Booking Integrity**: Prevent double-booking at the DATABASE level using `tstzrange` and `EXCLUDE USING gist`. Do not rely solely on application logic.
- **Split Commission**: Payment split must be atomic. Specialist share and salon share must be calculated and recorded in the same transaction.
- **Pilot Phase Only**: Do NOT introduce partitioning, AI assistants, advanced analytics, or microservices during the pilot. Stay within the 8-week, 2-person + AI scope.

## Tech Stack
- **Backend**: NestJS (Node.js)
- **Database**: PostgreSQL with RLS
- **Cache**: Redis (same VPS)
- **Frontend**: Flutter (Monorepo with shared package)
- **Maps**: Neshan Maps Flutter SDK
- **SMS/OTP**: Kavenegar
- **Infra**: Single VPS (4GB RAM, 2 vCPU) with Docker Compose

## Commands
- Backend dev: `cd backend && npm run start:dev`
- Backend test: `cd backend && npm run test`
- Flutter analyze: `cd frontend && flutter analyze`
- Docker compose up: `docker compose up -d`
- Run migrations: `cd backend && npm run migration:run`

## Conventions
- Use **2-space indentation** for TypeScript/Dart.
- Prefer **explicit types** over `any`.
- All new database columns must be **nullable or have defaults** for backward compatibility.
- Every new API endpoint must have a corresponding **OpenAPI decorator** (NestJS Swagger).
- Write **unit tests** for critical paths (booking, payment split, RLS policies).

## Gotchas
- `current_setting('app.current_tenant_id')` must be set via `SET LOCAL` at the start of **every transaction**. Failure to do so will cause RLS to block all rows.
- Redis cache **cannot** be used with PM2 cluster mode unless using a shared external store. Use `@nestjs/cache-manager` with Redis, not in-memory cache.