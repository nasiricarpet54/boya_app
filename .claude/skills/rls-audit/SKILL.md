---
name: rls-audit
description: Audit PostgreSQL RLS policies, tenant_id indexing, and session variable usage across all tenant-scoped tables.
---

## Audit Steps
1. List all tables in the `public` schema.
2. For each table with a `tenant_id` column, verify:
   - RLS is enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - A policy exists using `current_setting('app.current_tenant_id')`.
   - An index exists with `tenant_id` as the **leading column** (B-tree).
3. Check application code for `SET LOCAL app.current_tenant_id` at transaction start.
4. Flag tables missing RLS or missing tenant_id index as BLOCKERS.

## Output
Table of findings:

| Table | RLS Enabled | Policy Exists | Tenant Index | Status |
|-------|-------------|---------------|--------------|--------|

Then detail each issue with file references and suggested DDL fixes.