'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowRight, Ban, CheckCircle2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { LocationSelector, type LocationValue } from '@/components/location/location-selector';
import { useToast } from '@/components/providers/ToastProvider';
import { Link, useRouter } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { tenantsApi, type TenantStatus, type UpdateTenantBody } from '@/lib/api/tenants';
import { DetailBody } from './detail-body';

function statusTone(s: TenantStatus): BadgeTone {
  if (s === 'approved') return 'success';
  if (s === 'pending_approval') return 'warning';
  if (s === 'suspended') return 'error';
  if (s === 'archived') return 'neutral';
  return 'neutral';
}

export default function TenantDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('tenants');
  const td = useTranslations('tenants.detail');
  const te = useTranslations('tenants.edit');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Drafts for the edit form. `null` = not yet seeded from the server record.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameEnDraft, setNameEnDraft] = useState<string | null>(null);
  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);
  const [featuredDraft, setFeaturedDraft] = useState<boolean | null>(null);
  // `null` = not yet seeded from the server record; the ids are the source of
  // truth, the joined names come along for display via `detail`.
  const [locationDraft, setLocationDraft] = useState<LocationValue | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Deep-link support: /tenants/:id?edit=true opens the form directly.
  useEffect(() => {
    if (searchParams.get('edit') === 'true') setEditing(true);
  }, [searchParams]);
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
  const updateMutation = useMutation({
    mutationFn: (body: UpdateTenantBody) => tenantsApi.updateTenant(params.id, body),
    onSuccess: async () => { setEditing(false); setFormError(null); await invalidate(); toast({ title: te('saved'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, te('saveFailed')), variant: 'error' }),
  });
  // Archive: hides the salon from the main list (status=archived). On success bounce to the list.
  const deleteMutation = useMutation({
    mutationFn: () => tenantsApi.deleteTenant(params.id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      toast({ title: te('deleted'), variant: 'success' });
      router.push('/tenants');
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, te('deleteFailed')), variant: 'error' }),
  });
  const restoreMutation = useMutation({
    mutationFn: () => tenantsApi.restoreTenant(params.id),
    onSuccess: async () => { await invalidate(); toast({ title: td('restoredToast'), variant: 'success' }); },
    onError: (e) => toast({ title: getApiErrorMessage(e, td('restoreFailed')), variant: 'error' }),
  });
  const detail = query.data;
  const statusLabels: Record<TenantStatus, string> = {
    approved: t('statusApproved'), pending_approval: t('statusPending'),
    suspended: t('statusSuspended'), rejected: t('statusRejected'), archived: t('statusArchived'),
  };
  // Edit-form values: the seeded server value until the admin types.
  const nameValue = nameDraft ?? detail?.name ?? '';
  const nameEnValue = nameEnDraft ?? detail?.nameEn ?? '';
  const slugValue = slugDraft ?? detail?.slug ?? '';
  const addressValue = addressDraft ?? detail?.address ?? '';
  const phoneValue = phoneDraft ?? detail?.phone ?? '';
  const locationValue: LocationValue = locationDraft ?? {
    provinceId: detail?.provinceId ?? undefined,
    cityId: detail?.cityId ?? undefined,
  };
  // discount/featured/category are PATCH-only (not echoed by GET /admin/tenants/:id),
  // so they start blank/off until the admin sets them.
  const discountValue = discountDraft ?? '';
  const featuredValue = featuredDraft ?? false;
  const startEdit = () => {
    if (!detail) return;
    setNameDraft(detail.name);
    setNameEnDraft(detail.nameEn ?? '');
    setSlugDraft(detail.slug ?? '');
    setAddressDraft(detail.address ?? '');
    setPhoneDraft(detail.phone ?? '');
    setDiscountDraft('');
    setFeaturedDraft(false);
    setLocationDraft({
      provinceId: detail.provinceId ?? undefined,
      cityId: detail.cityId ?? undefined,
    });
    setFormError(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setNameDraft(null); setNameEnDraft(null); setSlugDraft(null);
    setAddressDraft(null); setPhoneDraft(null); setDiscountDraft(null);
    setFeaturedDraft(null); setLocationDraft(null); setFormError(null);
  };
  const submitEdit = () => {
    const cleanName = nameValue.trim();
    const cleanSlug = slugValue.trim().toLowerCase();
    if (cleanName.length < 2) { setFormError(te('nameRequired')); return; }
    if (cleanSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) { setFormError(te('slugInvalid')); return; }
    const cleanPhone = phoneValue.trim();
    if (cleanPhone && !/^09[0-9]{9}$/.test(cleanPhone)) { setFormError(te('phoneInvalid')); return; }
    let discountPercent: number | undefined;
    if (discountValue.trim() !== '') {
      const n = Number(discountValue.trim());
      if (!Number.isInteger(n) || n < 0 || n > 100) { setFormError(te('discountInvalid')); return; }
      discountPercent = n;
    }
    setFormError(null);
    const body: UpdateTenantBody = {
      name: cleanName,
      nameEn: nameEnValue.trim() || undefined,
      slug: cleanSlug || undefined,
      address: addressValue.trim() || undefined,
      phone: cleanPhone || undefined,
      discountPercent,
      isFeatured: featuredValue || undefined,
      // The link is optional, so an empty choice is an explicit clear, not a
      // no-op: `null` removes it, `undefined` would leave the old id in place.
      provinceId: locationValue.provinceId ?? null,
      cityId: locationValue.cityId ?? null,
    };
    updateMutation.mutate(body);
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
      {detail.status === 'archived' ? (
        <Card className="mb-4 border-line bg-cream/60">
          <CardTitle>{td('archivedBanner')}</CardTitle>
          <div className="mt-3">
            <Button size="sm" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              {restoreMutation.isPending ? tCommon('loading') : td('restore')}
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(detail.status)}>{statusLabels[detail.status]}</Badge>
        {detail.status === 'archived' ? null : detail.status !== 'approved' ? (
          <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />{detail.status === 'suspended' ? td('reactivate') : td('approve')}
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => { setReason(''); setSuspendOpen(true); }}>
            <Ban className="h-4 w-4" aria-hidden />{td('suspend')}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={startEdit} disabled={editing || detail.status === 'archived'}>
          <Pencil className="h-4 w-4" aria-hidden />{te('button')}
        </Button>
      </div>
      {editing ? (
        <Card className="mb-4">
          <CardTitle>{te('button')}</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label={te('nameLabel')} value={nameValue} onChange={(e) => setNameDraft(e.target.value)} disabled={updateMutation.isPending} />
            <Input label={te('nameEnLabel')} value={nameEnValue} onChange={(e) => setNameEnDraft(e.target.value)} dir="ltr" disabled={updateMutation.isPending} />
            <Input label={te('slugLabel')} value={slugValue} onChange={(e) => setSlugDraft(e.target.value)} dir="ltr" disabled={updateMutation.isPending} />
            <Input label={te('phoneLabel')} value={phoneValue} onChange={(e) => setPhoneDraft(e.target.value)} numeric inputMode="tel" disabled={updateMutation.isPending} />
            <div className="sm:col-span-2">
              <Input label={te('addressLabel')} value={addressValue} onChange={(e) => setAddressDraft(e.target.value)} disabled={updateMutation.isPending} />
            </div>
            <div className="sm:col-span-2">
              <LocationSelector
                value={locationValue}
                onChange={setLocationDraft}
                disabled={updateMutation.isPending}
              />
            </div>
            <Input label={te('discountLabel')} value={discountValue} onChange={(e) => setDiscountDraft(e.target.value)} numeric inputMode="numeric" disabled={updateMutation.isPending} />
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={featuredValue}
                aria-label={te('featuredLabel')}
                onClick={() => setFeaturedDraft(!featuredValue)}
                disabled={updateMutation.isPending}
                className={featuredValue
                  ? 'relative h-6 w-11 shrink-0 rounded-full bg-brand-copper transition-colors'
                  : 'relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors'}
              >
                <span
                  aria-hidden
                  className={featuredValue
                    ? 'absolute top-0.5 start-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform -translate-x-5 rtl:translate-x-5'
                    : 'absolute top-0.5 start-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform'}
                />
              </button>
              <span className="text-body text-ink">{te('featuredLabel')}</span>
            </div>
          </div>
          {formError ? <p className="mt-3 text-caption text-error">{formError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? te('saving') : te('save')}
            </Button>
            <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={updateMutation.isPending}>
              {te('cancel')}
            </Button>
          </div>
        </Card>
      ) : null}
      <DetailBody detail={detail} hours={hours} stats={stats} suspendOpen={suspendOpen} setSuspendOpen={setSuspendOpen} reason={reason} setReason={setReason} suspendPending={suspendMutation.isPending} onSuspend={() => suspendMutation.mutate(reason.trim())} />
      {detail.status === 'archived' ? null : (
      <Card className="mt-4 border-error/40">
        <CardTitle>{te('deleteTitle')}</CardTitle>
        <CardCaption className="mt-1">{te('deleteConfirmDesc')}</CardCaption>
        <div className="mt-3">
          <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />{te('deleteButton')}
          </Button>
        </div>
      </Card>
      )}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => { if (!o && !deleteMutation.isPending) setDeleteOpen(false); }}
        title={te('deleteTitle')}
        description={te('deleteConfirmDesc')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? tCommon('loading') : te('deleteConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-body font-semibold text-ink">{detail.name}</p>
      </Dialog>
    </>
  );
}

