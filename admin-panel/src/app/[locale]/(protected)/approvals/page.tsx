'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Eye, X } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/providers/ToastProvider';
import { approvalsApi, type ApprovalItem, type ApprovalType } from '@/lib/api/approvals';
import { getApiErrorMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/utils/format-date';
import { faDigits } from '@/lib/utils/persian';

const TABS: Array<{ key: string; type: ApprovalType }> = [
  { key: 'tenants', type: 'tenant' },
  { key: 'serviceLines', type: 'service_line' },
  { key: 'specialists', type: 'specialist' },
];

/**
 * Formats a `pending_changes` value for the diff table. Objects and arrays are
 * stringified so the admin sees the raw proposed payload, scalars pass as-is.
 */
function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function PendingChangesTable({
  changes,
  noChangesLabel,
}: {
  changes: Record<string, unknown> | null;
  noChangesLabel: string;
}) {
  const entries = changes ? Object.entries(changes) : [];

  if (entries.length === 0) {
    return <p className="py-4 text-center text-caption text-ink-muted">{noChangesLabel}</p>;
  }

  return (
    <dl className="overflow-hidden rounded-md border border-line">
      {entries.map(([field, value], index) => (
        <div
          key={field}
          className={index % 2 === 0 ? 'bg-cream/60 px-4 py-2.5' : 'bg-surface px-4 py-2.5'}
        >
          <dt className="text-overline font-medium text-ink-muted" dir="ltr">
            {field}
          </dt>
          <dd className="mt-0.5 break-words text-body text-ink">
            {formatChangeValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ApprovalsPage() {
  const locale = useLocale();
  const tNav = useTranslations('nav');
  const t = useTranslations('approvals');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ApprovalType>('tenant');

  // The record the detail dialog shows; `null` keeps it closed.
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  // Reject dialog state: the record under review plus the typed reason.
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // One query per tab so switching never refetches a visited queue. The
  // request pins `pending_approval` explicitly even though it is the backend
  // default, so the panel and the API cannot drift apart silently.
  const tenantQuery = useQuery({
    queryKey: ['admin-approvals', 'tenant'],
    queryFn: () => approvalsApi.list({ type: 'tenant', status: 'pending_approval' }),
  });
  const lineQuery = useQuery({
    queryKey: ['admin-approvals', 'service_line'],
    queryFn: () => approvalsApi.list({ type: 'service_line', status: 'pending_approval' }),
  });
  const specialistQuery = useQuery({
    queryKey: ['admin-approvals', 'specialist'],
    queryFn: () => approvalsApi.list({ type: 'specialist', status: 'pending_approval' }),
  });

  const queries: Record<ApprovalType, typeof tenantQuery> = {
    tenant: tenantQuery,
    service_line: lineQuery,
    specialist: specialistQuery,
  };
  const activeQuery = queries[activeTab];
  const items = activeQuery.data?.data ?? [];

  const invalidateQueues = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-approvals'] }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    );

  const approveMutation = useMutation({
    mutationFn: (item: ApprovalItem) => approvalsApi.approveItem(item.type, item.id),
    onSuccess: async () => {
      setSelected(null);
      await invalidateQueues();
      toast({ title: t('approvedToast'), variant: 'success' });
    },
    onError: (cause) => {
      toast({ title: getApiErrorMessage(cause, t('actionFailed')), variant: 'error' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ item, reason }: { item: ApprovalItem; reason: string }) =>
      approvalsApi.rejectItem(item.type, item.id, reason),
    onSuccess: async () => {
      setRejectTarget(null);
      setRejectReason('');
      setRejectError(null);
      setSelected(null);
      await invalidateQueues();
      toast({ title: t('rejectedToast'), variant: 'success' });
    },
    onError: (cause) => {
      setRejectError(getApiErrorMessage(cause, t('actionFailed')));
    },
  });

  const handleRejectSubmit = () => {
    if (!rejectTarget) return;

    // The reason is required client-side too: the backend 400s without it, but
    // the admin deserves the message next to the field, not as a toast.
    if (rejectReason.trim().length === 0) {
      setRejectError(t('reasonRequired'));
      return;
    }

    rejectMutation.mutate({ item: rejectTarget, reason: rejectReason.trim() });
  };

  return (
    <>
      <PageHeader title={tNav('approvals')} subtitle={t('subtitle')} />

      <div
        role="tablist"
        aria-label={tNav('approvals')}
        className="mb-4 flex gap-1 rounded-lg bg-surface p-1 shadow-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.type === activeTab;
          return (
            <button
              key={tab.type}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.type)}
              className={
                isActive
                  ? 'flex-1 rounded-md bg-brand-subtle px-4 py-2.5 text-body font-semibold text-brand-copper'
                  : 'flex-1 rounded-md px-4 py-2.5 text-body text-ink-muted transition-colors hover:text-ink'
              }
            >
              {t(`tabs.${tab.key}`)}
              {queries[tab.type].data ? (
                <span className="ms-2 text-overline">
                  ({faDigits(queries[tab.type].data?.total ?? 0)})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Card>
        {activeQuery.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-line/40" aria-hidden />
            ))}
          </div>
        ) : activeQuery.isError || !activeQuery.data ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{tErrors('generic')}</CardTitle>
              <CardCaption className="mt-1">
                {getApiErrorMessage(activeQuery.error, tErrors('generic'))}
              </CardCaption>
            </div>

            <Button
              variant="secondary"
              onClick={() => void activeQuery.refetch()}
              disabled={activeQuery.isFetching}
            >
              {activeQuery.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">
                    {item.name ?? t('unknownName')}
                  </p>
                  <p className="mt-0.5 text-overline text-ink-muted" dir="ltr">
                    {item.createdAt ? formatDateTime(item.createdAt, locale) : '—'}
                  </p>
                </div>

                <Badge tone="warning">{t('statusPending')}</Badge>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(item)}
                    title={t('view')}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    {t('view')}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => approveMutation.mutate(item)}
                    disabled={approveMutation.isPending}
                    title={t('approve')}
                  >
                    <Check className="h-4 w-4 text-success" aria-hidden />
                    {t('approve')}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRejectTarget(item);
                      setRejectReason('');
                      setRejectError(null);
                    }}
                    title={t('reject')}
                  >
                    <X className="h-4 w-4 text-error" aria-hidden />
                    {t('reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Detail dialog: record fields plus the proposed-change diff. */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={t('detailsTitle')}
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-overline text-ink-muted">{t('name')}</dt>
                <dd className="mt-0.5 text-body font-semibold text-ink">
                  {selected.name ?? t('unknownName')}
                </dd>
              </div>

              <div>
                <dt className="text-overline text-ink-muted">{t('type')}</dt>
                <dd className="mt-0.5 text-body text-ink">
                  {t(`tabs.${TABS.find((tab) => tab.type === selected.type)?.key ?? 'tenants'}`)}
                </dd>
              </div>

              <div>
                <dt className="text-overline text-ink-muted">{t('date')}</dt>
                <dd className="mt-0.5 text-body text-ink" dir="ltr">
                  {selected.createdAt ? formatDateTime(selected.createdAt, locale) : '—'}
                </dd>
              </div>

              <div>
                <dt className="text-overline text-ink-muted">{t('status')}</dt>
                <dd className="mt-0.5">
                  <Badge tone="warning">{t('statusPending')}</Badge>
                </dd>
              </div>
            </dl>

            <div>
              <p className="mb-1.5 text-caption font-medium text-ink">{t('pendingChanges')}</p>
              <PendingChangesTable changes={selected.pendingChanges} noChangesLabel={t('noPendingChanges')} />
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* Reject dialog: reason is mandatory, enforced before the request. */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !rejectMutation.isPending) {
            setRejectTarget(null);
            setRejectReason('');
            setRejectError(null);
          }
        }}
        title={t('rejectTitle')}
        description={t('rejectDescription')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
                setRejectError(null);
              }}
              disabled={rejectMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>

            <Button
              variant="danger"
              onClick={handleRejectSubmit}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? tCommon('loading') : t('reject')}
            </Button>
          </>
        }
      >
        <Input
          label={t('reasonLabel')}
          placeholder={t('reasonPlaceholder')}
          value={rejectReason}
          onChange={(event) => {
            setRejectReason(event.target.value);
            if (rejectError) setRejectError(null);
          }}
          disabled={rejectMutation.isPending}
          error={rejectError ?? undefined}
        />
      </Dialog>
    </>
  );
}
