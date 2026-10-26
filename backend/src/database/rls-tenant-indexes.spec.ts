import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(__dirname, 'migrations');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.ts'));
// One concatenated source: an index may live in a later migration than the one
// that enabled RLS, so the audit must span the whole chain, not single files.
const all = files.map((f) => readFileSync(join(migrationsDir, f), 'utf8')).join('\n');

/**
 * RLS tables whose policy keys on a column *other* than a local tenant_id, so
 * a tenant-leading index would not help them:
 * - refresh_tokens / support_tickets: user-scoped (`app.current_user_id`).
 * - tenants: the policy keys on `id`, which is the primary key.
 * - ticket_messages: has no tenant_id column at all — the policy resolves the
 *   tenant through the parent `tickets` row via `ticket_id`, which is indexed
 *   (idx_ticket_messages_ticket_id) and tickets itself is audited here.
 */
const exempt = new Set([
  'refresh_tokens',
  'support_tickets',
  'tenants',
  'ticket_messages',
]);

const rlsTables = [
  ...all.matchAll(/ALTER TABLE (?:ONLY )?"?([a-z_]+)"? ENABLE ROW LEVEL SECURITY/g),
].map((m) => m[1]);
// Static text scan cannot see RLS enabled through a runtime loop: 1792048339008
// does `for (const table of ['tenants', 'specialists', 'services', 'bookings',
// 'transactions'])` — the audit would silently miss those tables (false safety),
// so they are pinned here. bookings/transactions also appear statically, the
// dedupe handles the overlap.
const dynamicRlsTables = [
  'tenants',
  'specialists',
  'services',
  'bookings',
  'transactions',
];
const unique = [...new Set([...rlsTables, ...dynamicRlsTables])].filter(
  (t) => !exempt.has(t),
);

describe('RLS tenant-index audit', () => {
  it('finds RLS-enabled tables', () => {
    expect(unique.length).toBeGreaterThan(0);
  });

  it.each(unique)(
    '%s has a B-tree index with tenant_id as the leading column',
    (table) => {
      const hasTenantLeadingIndex = new RegExp(
        `CREATE (UNIQUE )?INDEX[^;]*ON "?${table}"?\\s*\\(\\s*tenant_id`,
      ).test(all);
      expect(hasTenantLeadingIndex).toBe(true);
    },
  );
});
