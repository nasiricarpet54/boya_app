-- Add partial exclusion constraint for whole-salon blocks to fix Blocker #1
-- This ensures that overlapping whole-salon blocks cannot be created
-- WHERE clause: applies ONLY when both tenant_id and specialist_id are NULL

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create the constraint for whole-salon blocks
ALTER TABLE schedule_blocks 
ADD CONSTRAINT EX_schedule_blocks_whole_salon
EXCLUDE USING gist (
    tstzrange(start_time, end_time, '[)') WITH &&
) 
WHERE (tenant_id IS NULL AND specialist_id IS NULL);

-- Verify constraint was created
SELECT conname, relname, pg_get_constraintdef(oid) 
FROM pg_constraint c
JOIN pg_class cls ON c.conrelid = cls.oid
WHERE conname LIKE 'EX_schedule_blocks%';

-- Verify the constraint exists in pg_index for GiST structure
SELECT indexrelid::regclass::text as index_name
FROM pg_index i
JOIN pg_rel i ON i.indexrelid = r.oid
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relkind = 'i' 
AND c.relnamespace = 'your_schema'::regnamespace
AND i.indoption[0] & 1 != 0;

-- Test the constraint (should fail if overlaps exist)
-- This ensures new checks prevent duplicates
INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason)
VALUES (NULL, NULL, NOW(), NOW() + INTERVAL '1 hour', 'Test');

INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason)
VALUES (NULL, NULL, NOW(), NOW() + INTERVAL '1 hour', 'Duplicate Test');

-- Rollback test changes
DELETE FROM schedule_blocks WHERE reason = 'Test';
DELETE FROM schedule_blocks WHERE reason = 'Duplicate Test';
