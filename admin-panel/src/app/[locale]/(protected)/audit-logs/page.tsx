'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { getApiErrorMessage } from '@/lib/api/errors';
import { auditApi, type AuditActionFilter, type AuditTargetFilter } from '@/lib/api/audit';
import { jalaliDateTime } from '@/lib/utils/jalali';
import { faDigits } from '@/lib/utils/persian';
import { cn } from '@/lib/utils/cn';

const ACTION_FILTERS: AuditActionFilter[] = ['all', 'tenant.', 'user.', 'booking.'];
const TARGET_FILTERS: AuditTargetFilter[] = ['all', 'tenant', 'user', 'booking'];

export default function AuditLogsPage() {
  const t = useTranslations('auditLogs');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [action, setAction] = useState<AuditActionFilter>('all');
  const [targetType, setTargetType] = useState<AuditTargetFilter>('all');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin-audit-logs', { action, targetType, page }],
    queryFn: () =>
      auditApi.listAuditLogs({
        action: action === 'all' ? undefined : action,
        targetType: targetType === 'all' ? undefined : targetType,
        page,
      }),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.data ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const currentPage = query.data?.page ?? page;

  /** `all` translates, the rest render as the literal pattern (`tenant.*`). */
  const chipLabel = (v: AuditActionFilter) => (v === 'all' ? t('filters.all') : `${v}*`);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          <div role="group" aria-label={t('filters.actionGroup')} className="flex flex-wrap gap-1 rounded-lg bg-cream/60 p-1">
            {ACTION_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === action}
                onClick={() => { setAction(v); setPage(1); }}
                className={cn('rounded-md px-4 py-2 text-body transition-colors', v === action ? 'bg-surface font-semibold text-brand-copper shadow-1' : 'text-ink-muted hover:text-ink')}
              >
                {chipLabel(v)}
              </button>
            ))}
          </div>

          <div role="group" aria-label={t('filters.targetGroup')} className="flex flex-wrap gap-1 rounded-lg bg-cream/60 p-1">
            {TARGET_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === targetType}
                onClick={() => { setTargetType(v); setPage(1); }}
                className={cn('rounded-md px-4 py-2 text-body transition-colors', v === targetType ? 'bg-surface font-semibold text-brand-copper shadow-1' : 'text-ink-muted hover:text-ink')}
              >
                {v === 'all' ? t('filters.all') : v}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        {query.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (<div key={i} className="h-14 animate-pulse rounded-md bg-line/40" aria-hidden />))}
          </div>
        ) : query.isError || !query.data ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{tErrors('generic')}</CardTitle>
              <CardCaption className="mt-1">{getApiErrorMessage(query.error, tErrors('generic'))}</CardCaption>
            </div>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-line text-overline text-ink-muted">
                    <th className="px-3 py-2.5 font-medium">{t('table.when')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.actor')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.action')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.target')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.reason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-cream/40">
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink-muted">{jalaliDateTime(item.createdAt)}</td>
                      <td className="max-w-44 truncate px-3 py-3 text-body text-ink">
                        {item.actorName ?? (item.actorPhone ? faDigits(item.actorPhone) : '—')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink" dir="ltr">{item.action}</td>
                      <td className="max-w-44 truncate px-3 py-3 text-body text-ink">
                        {item.targetLabel ?? item.targetId ?? '—'}
                      </td>
                      <td className="max-w-72 truncate px-3 py-3 text-caption text-ink-muted">{item.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
                <Button variant="secondary" size="sm" disabled={currentPage <= 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('prev')}</Button>
                <p className="text-caption text-ink-muted">{faDigits(`${currentPage} / ${totalPages}`)}</p>
                <Button variant="secondary" size="sm" disabled={currentPage >= totalPages || query.isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{t('next')}</Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

