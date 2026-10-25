# Schedule Blocks Implementation Review Report

**Project:** Boya Backend - Schedule Blocks Enhancement  
**Reviewer:** Senior Backend Architect  
**Date:** 2026-10-26  
**Scope:** Schedule Blocks, Exclusion Constraints, RLS Policies, Query Optimization  

---

## 🔴 Blockers (Critical Issues)

### 1. Exclusion Constraint Edge Case for Whole-Salon Blocks
**Location:** `migration 1792700000000-ScheduleBlocksForMobile.ts`

**Issue:** The constraint `EXCLUDE USING gist (tenant_id WITH =, specialist_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)` does NOT prevent overlapping whole-salon blocks because `NULL = NULL` evaluates to NULL, not TRUE.

**Fix:** Create a partial exclusion constraint:
```sql
ALTER TABLE schedule_blocks ADD CONSTRAINT EX_schedule_blocks_whole_salon
EXCLUDE USING gist (tstzrange(start_time, end_time, '[)') WITH &&)
WHERE (tenant_id IS NULL AND specialist_id IS NULL);
```

**Priority:** HIGH

### 2. RLS Policies for Mobile Specialists
**Issue:** `mobile_specialist_blocks` policy relies on `app.current_user_id` being set. Ensure JWT auth guard sets this GUC consistently.

**Fix:** Update `JWTAuthGuard` to set `app.current_user_id` for all mobile specialist tokens.

**Priority:** HIGH

---

## 🟡 Suggestions (Important Improvements)

### 1. Query Optimization for Calendar Endpoints
**Current:** 4-5 queries per request to check bookings + schedule blocks separately.

**Optimized:** Combine into single CTE query reducing to 1 query.

### 2. Database Indexes
Add B-tree indexes for frequent patterns:
```sql
CREATE INDEX idx_schedule_blocks_tenant_active ON schedule_blocks(tenant_id, start_time, end_time) WHERE specialist_id IS NOT NULL;
CREATE INDEX idx_schedule_blocks_mobile ON schedule_blocks(specialist_id, start_time, end_time) WHERE tenant_id IS NULL;
```

### 3. Application-Level Validation
Add `endTime > startTime` validation in service layer before database query.

---

## 💭 Nits

1. Remove Persian comment in `schedule-block.entity.ts`
2. Add custom validator for `endTime > startTime` in DTO
3. Use random UUIDs in integration tests
4. Split migration into smaller focused files
5. Add concurrent block creation stress test

---

## Test Coverage

### New Integration Tests Created
- **File:** `backend/test/integration/schedule-blocks-exclusion.integration-spec.ts`
- **Tests:** 7 tests covering:
  - Exclusion constraint for same specialist (block overlapping)
  - Blocks for different specialists allowed
  - Whole-salon block overlap prevention
  - Mobile specialist block overlap prevention  
  - Non-overlapping blocks allowed
  - RLS tenant isolation
  - Mobile specialist visibility isolation

---

## Recommendations

- [ ] Create partial exclusion constraint for whole-salon blocks (Blocker #1)
- [ ] Update JWT auth guard for mobile specialists (Blocker #2)
- [ ] Refactor availability service to unified query (Suggestion #1)
- [ ] Add missing indexes (Suggestion #2)
- [ ] Run all integration tests with Docker

---

## Database Schema

**Table:** `schedule_blocks`
- `id` (uuid PK)
- `tenant_id` (uuid, FK to tenants)
- `specialist_id` (uuid, FK to specialists)
- `start_time` (timestamptz)
- `end_time` (timestamptz)
- `reason` (varchar)
- `created_at`, `updated_at` (timestamptz)

**Constraints:**
- `no_overlapping_bookings` (GiST exclusion)
- `fk_schedule_blocks_tenant_id`
- `fk_schedule_blocks_specialist_id`

**RLS Policies:**
- `tenant_isolation_policy`
- `mobile_specialist_blocks`
- `whole_salon_blocks`
