import { Mail, Trash2 } from 'lucide-react';

import { useLocale } from 'next-intl';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { faDigits } from '@/lib/utils/persian';
import { formatDate } from '@/lib/utils/format-date';
import type { PendingInvite, InviteRole } from '@/lib/api/invites';

function roleTone(role: InviteRole): BadgeTone {
  if (role === 'salon_owner') return 'brand';
  if (role === 'line_manager') return 'info';
  return 'success';
}

interface InviteTableProps {
  items: PendingInvite[];
  roleLabels: Record<InviteRole, string>;
  /** Column captions, translated by the caller (same pattern as `roleLabels`). */
  headers: { contact: string; role: string; expiresAt: string };
  /** Revoke mutation in flight — the matching row's button is disabled. */
  revokingId: string | null;
  onRevoke: (invite: PendingInvite) => void;
  emptyLabel: string;
}

/**
 * Pending-invite rows: who was invited, for which role, when it expires, and a
 * per-row revoke. No pagination — pending invites are a small slice by design.
 */
export function InviteTable({
  items,
  roleLabels,
  headers,
  revokingId,
  onRevoke,
  emptyLabel,
}: InviteTableProps) {
  const locale = useLocale();
  if (items.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-10 text-center">
          <Mail className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
          <p className="text-body text-ink-muted">{emptyLabel}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-start text-body">
        <thead>
          <tr className="border-b border-line text-caption text-ink-muted">
            <th className="px-3 py-2.5 font-medium">{headers.contact}</th>
            <th className="px-3 py-2.5 font-medium">{headers.role}</th>
            <th className="px-3 py-2.5 font-medium">{headers.expiresAt}</th>
            <th className="px-3 py-2.5 font-medium" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-cream/40">
              <td className="whitespace-nowrap px-3 py-3 text-body font-semibold text-ink" dir="ltr">
                {item.phone ? faDigits(item.phone) : (item.email ?? '—')}
              </td>
              <td className="px-3 py-3">
                <Badge tone={roleTone(item.role)}>{roleLabels[item.role]}</Badge>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-caption text-ink-muted">
                {formatDate(item.expiresAt, locale)}
              </td>
              <td className="px-3 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revokingId === item.id}
                  onClick={() => onRevoke(item)}
                  className="text-error hover:bg-error/10"
                  aria-label={`revoke-${item.id}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
