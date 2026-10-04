# BOYA Platform — Project Charter

## Business Model (Phase 1: FREE SHOWCASE)

BOYA is a **showcase/vitrine platform** for beauty services in Iran.
In Phase 1, the platform is completely FREE for all parties:
- Customers
- Salon owners
- Line managers
- Specialists

**The platform DOES NOT:**
- Process any online payments
- Take any commission
- Hold any escrow
- Handle refunds
- Split any revenue

**The platform DOES:**
- Let salon owners define their profile, services, prices, hours, capacity
- Let line managers manage their specialists and available slots
- Let customers search, filter, compare, and book
- Suggest the best matching service based on customer filters
  (proximity, price, quality, discounts, availability)
- Ask for salon/line-manager approval before confirming a booking
- Send reminders (twice: after booking, after the visit)
- Collect customer satisfaction feedback (twice: at visit, 24h after)

**Payment flow:**
- Customer pays directly at the salon (cash/card)
- No money flows through the platform
- Cancellation policy is salon-defined, enforced by reputation not payment

## Monetization (Phase 2: FUTURE)

Later, salons can buy premium subscriptions for:
- Featured placement in search results and filters
- Higher ranking in customer discovery
- Push notification campaigns to targeted customers
- Analytics and insights

Phase 2 features should be ARCHITECTED from day 1 (feature flags,
subscription model in DB) but NOT SHIPPED until Phase 1 is validated.

## Booking Lifecycle

States (in order):
1. `pending` — customer requested, awaiting salon approval
2. `confirmed` — salon/line-manager approved
3. `completed` — customer visited and received service
4. `reviewed` — customer submitted feedback
5. `cancelled` — by customer, with salon-defined policy
6. `no_show` — customer didn't appear

Transitions:
- pending → confirmed (salon action)
- pending → cancelled (customer, up to X hours before)
- confirmed → completed (auto or salon-marked)
- confirmed → no_show (auto after start time + 30 min)
- completed → reviewed (customer submits review)
- any → cancelled (with policy enforcement)

## Core Value Proposition

For customers:
- Find the BEST beauty service based on multi-criteria matching
- See real availability
- Book without phone calls
- Free to use

For salon owners:
- Free digital storefront
- Manage services, prices, hours
- Get bookings without payment integration hassle
- Grow reputation via reviews

## Architecture Decisions (Phase 1)

- Payment module: EXISTS but DISABLED via feature flag `PAYMENTS_ENABLED=false`
- Booking: does NOT require payment
- Notification: SMS (Kavenegar) + FCM push + in-app
- Search: multi-criteria matching with weighted scoring
- Reviews: mandatory post-visit feedback with photo upload
- Multi-tenant: RLS on all tenant-scoped tables
- Roles: customer, salon_owner, line_manager, specialist, admin

## Tech Stack

Backend: NestJS 11 + TypeORM + PostgreSQL 16 (RLS) + Redis
Customer App: Flutter 3.47.5 (web + Android)
Salon App: Flutter (owner + line_manager + specialist)
Admin Panel: Next.js 14 (RTL, Persian)
Auth: OTP via Kavenegar
Maps: Neshan
Push: FCM
Deploy: Docker + nginx + Let's Encrypt on a single VPS

## Conventions

- Language: Persian (fa-IR) in UI, English in code
- Calendar: Jalali, week starts Saturday, Friday is weekend
- Numbers: Persian digits in UI, English in DB
- Font: Vazirmatn
- Direction: RTL
- Money: Tomans (no decimals, integer)
- Time: Asia/Tehran timezone

## Glossary

- Tenant / Salon: a beauty business
- Line / Service Line: a category within a salon (e.g., hair, nails, skin)
- Specialist: a person providing service (freelancer or commission-based)
- Line Manager: manages a service line and its specialists
- Booking: a customer appointment
- Slot: a time range available for booking
- Capacity: number of parallel bookings a specialist can handle
