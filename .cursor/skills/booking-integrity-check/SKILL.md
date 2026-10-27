---
name: booking-integrity-check
description: Verify that double-booking prevention is enforced at the database level with exclusion constraints and tested with concurrent requests.
---

## Verification Steps
1. Inspect migration files for `EXCLUDE USING gist` on the `bookings` table.
2. Confirm the constraint covers `specialist_id` and `tstzrange(start_time, end_time)`.
3. Review booking service code: it must rely on the database constraint, not a pre-check `SELECT`.
4. Run or write a concurrent test: two simultaneous inserts for the same specialist and overlapping time slot must result in exactly one success and one database error.

## Output
Report:
- Constraint DDL found: [yes/no] — file:line
- Application reliance on DB constraint: [yes/no]
- Concurrent test result: [pass/fail]
- BLOCKERS if any step fails.