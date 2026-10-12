'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Ban, CheckCircle2, Eye, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/providers/ToastProvider';
import { Link } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { tenantsApi, type TenantStatus, type TenantStatusFilter } from '@/lib/api/tenants';
import { formatDate } from '@/lib/utils/format-date';
import { faDigits, faNumber } from '@/lib/utils/persian';
import { cn } from '@/lib/utils/cn';
const FILTERS: TenantStatusFilter[] = ['all', 'approved', 'pending_approval', 'suspended', 'archived'];
function statusTone(s: TenantStatus): BadgeTone {
  if (s === 'approved') return 'success';
  if (s === 'pending_approval') return 'warning';
  if (s === 'suspended') return 'error';
  if (s === 'archived') return 'neutral';
  return 'neutral';
}
export default function TenantsPage() {
  const t = useTranslations('tenants');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const [filter, setFilter] = useState<TenantStatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ['admin-tenants', { search, status: filter, page }],
    queryFn: () => tenantsApi.listTenants({ search: search || undefined, status: filter, page }),
    placeholderData: (prev) => prev,
  });
  const items = query.data?.data ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const currentPage = query.data?.page ?? page;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tActions = useTranslations('tenants.actions');
  const te = useTranslations('tenants.edit');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  /** Refresh the list (and the detail page cache) after a status change. */
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['admin-tenant'] }));
  const approveMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.updateStatus(id, { status: 'approved' }),
    onSuccess: async () => { await invalidate(); toast({ title: tActions('approveToast'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, tActions('actionFailed')), variant: 'error' }),
  });
  const suspendMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.updateStatus(id, { status: 'suspended' }),
    onSuccess: async () => { await invalidate(); toast({ title: tActions('suspendToast'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, tActions('actionFailed')), variant: 'error' }),
  });
  // Archive from the list: confirm first, then hide from the main list.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.deleteTenant(id),
    onSuccess: async () => { setDeleteTarget(null); await invalidate(); toast({ title: te('deleted'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, te('deleteFailed')), variant: 'error' }),
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.restoreTenant(id),
    onSuccess: async () => { await invalidate(); toast({ title: tActions('restoreToast'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, tActions('restoreFailed')), variant: 'error' }),
  });
  const pendingId = approveMutation.variables ?? suspendMutation.variables ?? deleteMutation.variables ?? restoreMutation.variables;
  const statusLabels: Record<TenantStatus, string> = {
    approved: t('statusApproved'), pending_approval: t('statusPending'),
    suspended: t('statusSuspended'), rejected: t('statusRejected'), archived: t('statusArchived'),
  };
  const filterLabel = (v: TenantStatusFilter) =>
    v === 'all' ? t('filters.all') : v === 'approved' ? t('filters.approved')
    : v === 'pending_approval' ? t('filters.pending') : v === 'suspended' ? t('filters.suspended')
    : t('filters.archived');
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Link
          href="/tenants/create"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-copper px-3 text-caption font-semibold text-white transition-colors hover:bg-brand-copper-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('newSalon')}
        </Link>
      </div>
      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          <Input label={t('searchLabel')} placeholder={t('searchPlaceholder')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <div role="group" aria-label={t('searchLabel')} className="flex flex-wrap gap-1 rounded-lg bg-cream/60 p-1">
            {FILTERS.map((v) => (
              <button key={v} type="button" aria-pressed={v === filter} onClick={() => { setFilter(v); setPage(1); }}
                className={cn('rounded-md px-4 py-2 text-body transition-colors', v === filter ? 'bg-surface font-semibold text-brand-copper shadow-1' : 'text-ink-muted hover:text-ink')}>
                {filterLabel(v)}
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
            <div><CardTitle>{tErrors('generic')}</CardTitle>
            <CardCaption className="mt-1">{getApiErrorMessage(query.error, tErrors('generic'))}</CardCaption></div>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-line text-overline text-ink-muted">
                    <th className="px-3 py-2.5 font-medium">{t('table.name')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.slug')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.phone')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.city')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.status')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.bookings')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.specialists')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.rating')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.date')}</th>
                    <th className="px-3 py-2.5 font-medium" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-cream/40">
                      <td className="max-w-56 truncate px-3 py-3 text-body font-semibold text-ink">{item.name}</td>
                      <td className="px-3 py-3 text-caption text-ink-muted" dir="ltr">{item.slug ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink" dir="ltr">{item.phone ? faDigits(item.phone) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-body text-ink">{item.cityName ?? '—'}</td>
                      <td className="px-3 py-3"><Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge></td>
                      <td className="px-3 py-3 text-body text-ink">{faNumber(item.bookingsCount)}</td>
                      <td className="px-3 py-3 text-body text-ink">{faNumber(item.specialistsCount)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-body text-ink">{faDigits(item.rating.toFixed(1))} <span className="text-overline text-ink-muted">({faNumber(item.reviewCount)})</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink-muted">{formatDate(item.createdAt, locale)}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/tenants/${item.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-caption font-semibold text-brand-copper transition-colors hover:bg-brand-subtle">
                            <Eye className="h-4 w-4" aria-hidden />{t('table.view')}
                          </Link>
                          {item.status === 'archived' ? (
                            <Button
                              size="sm"
                              aria-label={`${tActions('restore')}: ${item.name}`}
                              disabled={pendingId === item.id}
                              onClick={() => restoreMutation.mutate(item.id)}
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden />{tActions('restore')}
                            </Button>
                          ) : (
                            <>
                              <Link
                                href={`/tenants/${item.id}?edit=true`}
                                aria-label={`${te('button')}: ${item.name}`}
                                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-caption font-semibold text-ink-muted transition-colors hover:bg-brand-subtle hover:text-ink"
                              >
                                <Pencil className="h-4 w-4" aria-hidden />{te('button')}
                              </Link>
                              {item.status === 'approved' ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  aria-label={`${tActions('suspend')}: ${item.name}`}
                                  disabled={pendingId === item.id}
                                  onClick={() => suspendMutation.mutate(item.id)}
                                >
                                  <Ban className="h-4 w-4" aria-hidden />{tActions('suspend')}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  aria-label={`${tActions('approve')}: ${item.name}`}
                                  disabled={pendingId === item.id}
                                  onClick={() => approveMutation.mutate(item.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                                  {item.status === 'suspended' ? tActions('reactivate') : tActions('approve')}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="danger"
                                aria-label={`${te('deleteButton')}: ${item.name}`}
                                disabled={pendingId === item.id}
                                onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
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
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o && !deleteMutation.isPending) setDeleteTarget(null); }}
        title={te('deleteTitle')}
        description={te('deleteConfirmDesc')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending || !deleteTarget}
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
            >
              {deleteMutation.isPending ? tCommon('loading') : te('deleteConfirm')}
            </Button>
          </>
        }
      >
        {deleteTarget ? <p className="text-body font-semibold text-ink">{deleteTarget.name}</p> : null}
      </Dialog>
    </>
  );
}
