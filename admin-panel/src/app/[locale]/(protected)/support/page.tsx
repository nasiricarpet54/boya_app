'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { getApiErrorMessage } from '@/lib/api/errors';
import {
  supportApi,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type UpdateTicketPayload,
} from '@/lib/api/support';
import { formatDate } from '@/lib/utils/format-date';
import { faDigits, faNumber } from '@/lib/utils/persian';

type StatusFilter = TicketStatus | 'all';
type TypeFilter = TicketType | 'all';
type PriorityFilter = TicketPriority | 'all';

const STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  open: 'warning',
  answered: 'success',
  closed: 'neutral',
};

const PRIORITY_TONE: Record<TicketPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'error',
};

export default function SupportPage() {
  const t = useTranslations('support');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [editStatus, setEditStatus] = useState<TicketStatus>('open');
  const [editPriority, setEditPriority] = useState<TicketPriority>('medium');
  const [editResponse, setEditResponse] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ['support-tickets', { status: statusFilter, type: typeFilter, priority: priorityFilter, search, page }],
    queryFn: () =>
      supportApi.listTickets({
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        search: search || undefined,
        page,
        limit: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const tickets = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTicketPayload }) =>
      supportApi.updateTicket(id, payload),
    onSuccess: () => {
      toast({ title: t('detail.saved'), variant: 'success' });
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, t('detail.saveFailed')) }),
  });

  function openDetail(ticket: SupportTicket) {
    setSelected(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditResponse(ticket.adminResponse ?? '');
  }

  const statusOptions: SelectOption[] = [
    { value: 'open', label: t('statuses.open') },
    { value: 'answered', label: t('statuses.answered') },
    { value: 'closed', label: t('statuses.closed') },
  ];

  const priorityOptions: SelectOption[] = [
    { value: 'low', label: t('priorities.low') },
    { value: 'medium', label: t('priorities.medium') },
    { value: 'high', label: t('priorities.high') },
  ];

  const typeOptions: SelectOption[] = [
    { value: 'all', label: t('filters.all') },
    { value: 'question', label: t('types.question') },
    { value: 'complaint', label: t('types.complaint') },
    { value: 'suggestion', label: t('types.suggestion') },
    { value: 'other', label: t('types.other') },
  ];

  const priorityFilterOptions: SelectOption[] = [
    { value: 'all', label: t('filters.all') },
    { value: 'low', label: t('priorities.low') },
    { value: 'medium', label: t('priorities.medium') },
    { value: 'high', label: t('priorities.high') },
  ];

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input
              label={t('searchLabel')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
          </div>
          <div className="min-w-40">
            <Select
              label={t('table.status')}
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
              options={[{ value: 'all', label: t('filters.all') }, ...statusOptions]}
            />
          </div>
          <div className="min-w-40">
            <Select
              label={t('table.type')}
              value={typeFilter}
              onValueChange={(v) => { setTypeFilter(v as TypeFilter); setPage(1); }}
              options={typeOptions}
            />
          </div>
          <div className="min-w-40">
            <Select
              label={t('table.priority')}
              value={priorityFilter}
              onValueChange={(v) => { setPriorityFilter(v as PriorityFilter); setPage(1); }}
              options={priorityFilterOptions}
            />
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-line/40" aria-hidden />
            ))}
          </div>
        ) : query.isError || !query.data ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{tErrors('generic')}</CardTitle>
              <p className="mt-1 text-caption text-ink-muted">
                {getApiErrorMessage(query.error, tErrors('generic'))}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        ) : tickets.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-line text-overline text-ink-muted">
                    <th className="px-3 py-2.5 font-medium">{t('table.subject')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.type')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.status')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.priority')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.date')}</th>
                    <th className="px-3 py-2.5 font-medium" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="transition-colors hover:bg-cream/40">
                      <td className="max-w-96 truncate px-3 py-3 text-body font-semibold text-ink">
                        {ticket.subject}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone="neutral">{t(`types.${ticket.type}`)}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={STATUS_TONE[ticket.status]}>
                          {t(`statuses.${ticket.status}`)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={PRIORITY_TONE[ticket.priority]}>
                          {t(`priorities.${ticket.priority}`)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink-muted">
                        {formatDate(ticket.createdAt, locale)}
                      </td>
                      <td className="px-3 py-3">
                        <Button size="sm" variant="secondary" onClick={() => openDetail(ticket)}>
                          <Eye className="h-4 w-4" aria-hidden />
                          {t('view')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('prev')}
                </Button>
                <p className="text-caption text-ink-muted">
                  {faDigits(`${page} / ${totalPages}`)}  {faNumber(total)} {t('countSuffix')}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages || query.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('next')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !updateMutation.isPending) setSelected(null);
        }}
        title={t('detail.title')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setSelected(null)}
              disabled={updateMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() =>
                selected &&
                updateMutation.mutate({
                  id: selected.id,
                  payload: {
                    status: editStatus,
                    priority: editPriority,
                    adminResponse: editResponse.trim() || undefined,
                  },
                })
              }
              disabled={updateMutation.isPending}
            >
              <Send className="h-4 w-4" aria-hidden />
              {updateMutation.isPending ? tCommon('loading') : t('detail.save')}
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-overline text-ink-muted">{t('detail.subject')}</p>
              <p className="mt-1 text-body font-semibold text-ink">{selected.subject}</p>
            </div>

            <div>
              <p className="text-overline text-ink-muted">{t('detail.message')}</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-cream/40 p-3 text-caption text-ink">
                {selected.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-overline text-ink-muted">{t('detail.type')}</p>
                <Badge tone="neutral">{t(`types.${selected.type}`)}</Badge>
              </div>
              <div>
                <p className="text-overline text-ink-muted">{t('detail.createdAt')}</p>
                <p className="text-body text-ink">{formatDate(selected.createdAt, locale)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label={t('detail.status')}
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as TicketStatus)}
                options={statusOptions}
              />
              <Select
                label={t('detail.priority')}
                value={editPriority}
                onValueChange={(v) => setEditPriority(v as TicketPriority)}
                options={priorityOptions}
              />
            </div>

            <div>
              <label className="mb-1 block text-caption font-medium text-ink">
                {t('detail.adminResponse')}
              </label>
              <textarea
                value={editResponse}
                onChange={(e) => setEditResponse(e.target.value)}
                placeholder={t('detail.adminResponsePlaceholder')}
                rows={5}
                className="w-full rounded-md border border-line bg-surface p-3 text-body text-ink placeholder:text-ink-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}