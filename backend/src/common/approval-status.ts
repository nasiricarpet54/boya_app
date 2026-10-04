/**
 * The approval lifecycle shared by `tenants`, `service_lines` and
 * `specialists`.
 *
 * One definition on purpose. The Postgres enum `approval_status` is created by
 * migration 1730000000018 and the three entities declare it through
 * `enumName`, so a value added here has to be added to that migration too —
 * but having it in exactly one file is what keeps the entity metadata, the
 * `?status=` validation in the admin queue and the `GET /salon/me/status`
 * response from drifting apart.
 *
 * `draft` is the DDL default, so a row inserted without a status starts
 * unreviewed; `pending_approval` is what a salon puts itself into by
 * submitting a gated edit.
 */
export const APPROVAL_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'suspended',
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** The three tables the approval workflow covers. */
export const APPROVAL_TYPES = ['tenant', 'service_line', 'specialist'] as const;

export type ApprovalType = (typeof APPROVAL_TYPES)[number];