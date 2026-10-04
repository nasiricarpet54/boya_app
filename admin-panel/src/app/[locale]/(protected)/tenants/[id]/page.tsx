'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowRight, Ban, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { useToast } from '@/components/providers/ToastProvider';
import { Link } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { tenantsApi, type TenantStatus } from '@/lib/api/tenants';
import { DetailBody } from './detail-body';

function statusTone(s: TenantStatus): BadgeTone {
  if (s === 'approved') return 'success';
  if (s === 'pending_approval') return 'warning';
  if (s === 'suspended') return 'error';
  return 'neutral';
}

export default function TenantDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('tenants');
  const td = useTranslations('tenants.detail');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['admin-tenant', params.id], queryFn: () => tenantsApi.getTenant(params.id) });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-tenant', params.id] }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }));
  const approveMutation = useMutation({
    mutationFn: () => tenantsApi.updateStatus(params.id, { status: 'approved' }),
    onSuccess: async () => { await invalidate(); toast({ title: td('approvedToast'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, td('actionFailed')), variant: 'error' }),
  });
  const suspendMutation = useMutation({
    mutationFn: (r: string) => tenantsApi.updateStatus(params.id, { status: 'suspended', reason: r || undefined }),
    onSuccess: async () => { setSuspendOpen(false); setReason(''); await invalidate(); toast({ title: td('suspendedToast'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, td('actionFailed')), variant: 'error' }),
  });
  const detail = query.data;
  const statusLabels: Record<TenantStatus, string> = {
    approved: t('statusApproved'), pending_approval: t('statusPending'),
    suspended: t('statusSuspended'), rejected: t('statusRejected'),
  };
  if (query.isLoading) {
    return (
      <>
        <PageHeader title={t('title')} />
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (<div key={i} className="h-40 animate-pulse rounded-lg bg-surface shadow-1" aria-hidden />))}
        </div>
      </>
    );
  }
  if (query.isError || !detail) {
    return (
      <>
        <PageHeader title={t('title')} />
        <Card>
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div><CardTitle>{tErrors('generic')}</CardTitle>
            <CardCaption className="mt-1">{getApiErrorMessage(query.error, tErrors('generic'))}</CardCaption></div>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        </Card>
      </>
    );
  }
  const hours = detail.workingHours ?? {};
  const stats = [
    { label: td('statBookings'), value: detail.stats.bookings },
    { label: td('statServices'), value: detail.stats.services },
    { label: td('statSpecialists'), value: detail.stats.specialists },
    { label: td('statLines'), value: detail.stats.lines },
  ];
  return (
    <>
      <Link href="/tenants" className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-caption font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink">
        <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />{td('back')}
      </Link>
      <PageHeader title={detail.name} subtitle={detail.slug ?? undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(detail.status)}>{statusLabels[detail.status]}</Badge>
        {detail.status !== 'approved' ? (
          <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />{detail.status === 'suspended' ? td('reactivate') : td('approve')}
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => { setReason(''); setSuspendOpen(true); }}>
            <Ban className="h-4 w-4" aria-hidden />{td('suspend')}
          </Button>
        )}
      </div>
      <DetailBody detail={detail} hours={hours} stats={stats} suspendOpen={suspendOpen} setSuspendOpen={setSuspendOpen} reason={reason} setReason={setReason} suspendPending={suspendMutation.isPending} onSuspend={() => suspendMutation.mutate(reason.trim())} />
    </>
  );
}

