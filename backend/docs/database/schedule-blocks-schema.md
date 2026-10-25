# Database Schema - Schedule Blocks

## Table: schedule_blocks

```sql
CREATE TABLE schedule_blocks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid REFERENCES tenants ON DELETE CASCADE,
    specialist_id uuid REFERENCES specialists ON DELETE CASCADE,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    reason VARCHAR,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure end_time > start_time
ALTER TABLE schedule_blocks ADD CONSTRAINT check_time_range CHECK (end_time > start_time);

--_enable RLS
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks FORCE ROW LEVEL SECURITY;

-- Existing RLS policies
CREATE POLICY tenant_isolation_policy ON schedule_blocks
FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY mobile_specialist_blocks ON schedule_blocks
FOR ALL USING (
    tenant_id IS NULL
    AND specialist_id IS NOT NULL
    AND specialist_id IN (
        SELECT id FROM specialists
        WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          AND is_active = true
    )
)
WITH CHECK (
    tenant_id IS NULL
    AND specialist_id IS NOT NULL
    AND specialist_id IN (
        SELECT id FROM specialists
        WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          AND is_active = true
    )
);

CREATE POLICY whole_salon_blocks ON schedule_blocks
FOR ALL USING (tenant_id IS NULL AND specialist_id IS NULL)
WITH CHECK (tenant_id IS NULL AND specialist_id IS NULL);

-- Existing Exclusion Constraint (for non-NULL specialist_id blocks)
ALTER TABLE schedule_blocks ADD CONSTRAINT EX_schedule_blocks_no_overlap
EXCLUDE USING gist (
    tenant_id WITH =,
    specialist_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
) WITH (fillfactor = 70);

-- NEW: Partial exclusion for whole-salon blocks (to fix Blocker #1)
ALTER TABLE schedule_blocks ADD CONSTRAINT EX_schedule_blocks_whole_salon
EXCLUDE USING gist (
    tstzrange(start_time, end_time, '[)') WITH &&
) WHERE (tenant_id IS NULL AND specialist_id IS NULL);

-- New indexes for query optimization
CREATE INDEX idx_schedule_blocks_tenant_on_active ON schedule_blocks(tenant_id, start_time, end_time) 
WHERE specialist_id IS NOT NULL;

CREATE INDEX idx_schedule_blocks_mobile ON schedule_blocks(specialist_id, start_time, end_time)
WHERE tenant_id IS NULL;

-- Index for booking service checks
CREATE INDEX idx_schedule_blocks_active_blocks ON schedule_blocks(tenant_id, specialist_id, start_time, end_time)
WHERE active IS TRUE;

```

## Relation to Other Tables

- **tenants**: The salon (`id`). NULL for mobile specialists.
- **specialists**: The provider (`id`). NULL for whole-salon blocks.
- **bookings**: Overlap checks between bookings and schedule_blocks.

## RLS Policy Behavior

| Block Type | tenant_id | specialist_id | Visible To |
|------------|-----------|---------------|------------|
| Salon Block | UUID (A) | UUID (Specialist) | Tenant A staff users |
| Mobile Block | NULL | UUID (Specialist) | Mobile specialist's own token |
| Whole Salon | NULL | NULL | Anyone with tenant context (salon staff) |

## Index Strategy

### B-tree Indexes
- Index on `(tenant_id, start_time, end_time)` for scheduling queries
- Index on `(specialist_id, start_time, end_time)` for mobile specialist

### GiST Index
- `EX_schedule_blocks_no_overlap` automatically creates GiST on `(tenant_id, specialist_id, tstzrange(...))`
- `EX_schedule_blocks_whole_salon` creates GiST on `(tstzrange(...))` for whole-salon blocks

## Sample Queries

### Check for Blocking Times (Booking Service)
```sql
SELECT 1 AS ok FROM schedule_blocks
WHERE tstzrange(start_time, end_time, '[)') && tstzrange($1, $2, '[)')
  AND (specialist_id IS NULL OR specialist_id = $3::uuid)
LIMIT 1;
```

### Get Available Slots (Combined Check)
```sql
WITH time_slots AS (
    SELECT slot_start, slot_end
    FROM generate_time_series($1, $2, '1 hour')
)
SELECT ts.*,
       EXISTS(SELECT 1 FROM bookings b WHERE b.specialist_id = $3 
              AND b.time_slot && tstzrange(ts.slot_start, ts.slot_end, '[)')
              AND b.status NOT IN ('cancelled', 'no_show')) AS booking_busy,
       EXISTS(SELECT 1 FROM schedule_blocks sb WHERE sb.specialist_id = $3
              OR sb.specialist_id IS NULL
              ), tstzrange(ts.slot_start, ts.slot_end, '[)') && tstzrange(sb.start_time, sb.end_time, '[)')) AS block_busy
FROM time_slots ts;
```

## Migration Notes

1. **Breaking Change**: Adding `EX Schedule_blocks_whole_salon` will fail if overlapping whole-salon blocks already exist. Database clean-up may be required.
2. **Performance**: The new GiST index on `(tstzrange)` for whole-salon blocks is lightweight because it's a partial index.
3. **Security**: RLS policies are correctly applied with `FORCE ROW LEVEL SECURITY` to prevent privilege escalation.

## Compliance

- **PostgreSQL Version**: 14+ (for `GENERATED ALWAYS AS` expression support)
- **Extensions**: `btree_gist` for mixed `= ` and `&&` operators
- **Role**: All DDL executed as `beauty_platform_owner` or equivalent superuser
