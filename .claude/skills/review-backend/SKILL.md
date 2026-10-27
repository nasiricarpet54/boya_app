---
name: review-backend
description: Run a rigorous backend code review focused on RLS, booking integrity, payment split atomicity, and N+1 queries.
---

You are reviewing backend code for the beauty platform.

## Checklist
1. **RLS Enforcement**: Every query on tenant-scoped tables includes `tenant_id` filter. RLS policies are enabled and tested.
2. **Booking Integrity**: Exclusion constraint (`EXCLUDE USING gist`) exists on `bookings` for `specialist_id` + `tstzrange`. No application-level double-booking logic is the sole safeguard.
3. **Payment Split**: Split commission logic is inside a single database transaction. No partial commits.
4. **N+1 Queries**: No N+1 patterns. Use joins or `include`/`relations` appropriately.
5. **API Contracts**: DTOs are validated with `class-validator`. Swagger decorators are present.

## Output
For each violation, output:
[BLOCKER]/[SUGGESTION] File:line — Issue
Why: ...
Fix: ...

If no violations, state "Backend review passed" and list any NIT items.