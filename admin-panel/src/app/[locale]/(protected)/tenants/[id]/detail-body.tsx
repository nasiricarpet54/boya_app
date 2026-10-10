'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { formatDate, formatDateTime } from '@/lib/utils/format-date';
import { faDigits, faNumber } from '@/lib/utils/persian';
import type { TenantDetail } from '@/lib/api/tenants';
const WEEK_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
const WEEK_FA: Record<string, string> = {
  sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه',
  wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه',
};
function formatDay(v: unknown): string {
  if (!v || typeof v !== 'object') return '—';
  const d = v as Record<string, unknown>;
  if (d.active === false) return '—';
  const a = typeof d.start === 'string' ? d.start : '';
  const b = typeof d.end === 'string' ? d.end : '';
  if (!a || !b) return '—';
  return `${faDigits(a)} - ${faDigits(b)}`;
}
export function DetailBody({ detail, hours, stats, suspendOpen, setSuspendOpen, reason, setReason, suspendPending, onSuspend }: {
  detail: TenantDetail;
  hours: Record<string, unknown>;
  stats: Array<{ label: string; value: number }>;
  suspendOpen: boolean;
  setSuspendOpen: (v: boolean) => void;
  reason: string;
  setReason: (v: string) => void;
  suspendPending: boolean;
  onSuspend: () => void;
}) {
  const td = useTranslations('tenants.detail');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>{td('basicInfo')}</CardTitle>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div><dt className="text-overline text-ink-muted">{td('name')}</dt><dd className="mt-0.5 text-body font-semibold text-ink">{detail.name}</dd></div>
            <div><dt className="text-overline text-ink-muted">{td('phone')}</dt><dd className="mt-0.5 text-body text-ink" dir="ltr">{detail.phone ? faDigits(detail.phone) : '—'}</dd></div>
            <div className="col-span-2"><dt className="text-overline text-ink-muted">{td('address')}</dt><dd className="mt-0.5 text-body text-ink">{detail.address ?? td('noAddress')}</dd></div>
            <div><dt className="text-overline text-ink-muted">{td('rating')}</dt><dd className="mt-0.5 text-body text-ink">{faDigits(detail.rating.toFixed(1))}</dd></div>
            <div><dt className="text-overline text-ink-muted">{td('reviews')}</dt><dd className="mt-0.5 text-body text-ink">{faNumber(detail.reviewCount)}</dd></div>
            <div><dt className="text-overline text-ink-muted">{td('slug')}</dt><dd className="mt-0.5 text-caption text-ink-muted" dir="ltr">{detail.slug ?? '—'}</dd></div>
            <div><dt className="text-overline text-ink-muted">{td('bookingTime')}</dt><dd className="mt-0.5 text-caption text-ink-muted">{formatDate(detail.createdAt, locale)}</dd></div>
          </dl>
        </Card>
        <Card>
          <CardTitle>{td('workingHours')}</CardTitle>
          {Object.keys(hours).length === 0 ? (
            <p className="py-6 text-center text-caption text-ink-muted">{td('noHours')}</p>
          ) : (
            <dl className="mt-3 overflow-hidden rounded-md border border-line">
              {WEEK_DAYS.map((day, i) => (
                <div key={day} className={i % 2 === 0 ? 'flex items-center justify-between bg-cream/60 px-4 py-2' : 'flex items-center justify-between bg-surface px-4 py-2'}>
                  <dt className="text-body text-ink">{WEEK_FA[day]}</dt>
                  <dd className="text-body text-ink-muted">{formatDay(hours[day])}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>
      <Card className="mt-4">
        <CardTitle>{td('stats')}</CardTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md bg-cream/60 px-4 py-3 text-center">
              <p className="text-headline font-bold text-ink">{faNumber(s.value)}</p>
              <p className="mt-0.5 text-caption text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-4">
        <CardTitle>{td('recentBookings')}</CardTitle>
        {detail.recentBookings.length === 0 ? (
          <p className="py-6 text-center text-caption text-ink-muted">{td('noBookings')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-right">
              <thead>
                <tr className="border-b border-line text-overline text-ink-muted">
                  <th className="px-3 py-2 font-medium">{td('bookingService')}</th>
                  <th className="px-3 py-2 font-medium">{td('bookingCustomer')}</th>
                  <th className="px-3 py-2 font-medium">{td('bookingTime')}</th>
                  <th className="px-3 py-2 font-medium">{td('bookingStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2.5 text-body text-ink">{b.serviceName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-caption text-ink">{b.customerName ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-caption text-ink-muted">{formatDateTime(b.startAt, locale)}</td>
                    <td className="px-3 py-2.5"><Badge tone="neutral">{b.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog
        open={suspendOpen}
        onOpenChange={(o) => { if (!o && !suspendPending) { setSuspendOpen(false); setReason(''); } }}
        title={td('suspendTitle')}
        description={td('suspendDescription')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setSuspendOpen(false); setReason(''); }} disabled={suspendPending}>{tCommon('cancel')}</Button>
            <Button variant="danger" onClick={onSuspend} disabled={suspendPending}>
              {suspendPending ? tCommon('loading') : td('suspend')}
            </Button>
          </>
        }
      >
        <Input label={td('reasonLabel')} placeholder={td('reasonPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)} disabled={suspendPending} />
      </Dialog>
    </>
  );
}