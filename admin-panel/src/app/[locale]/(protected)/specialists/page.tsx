'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, CheckCircle2, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { getApiErrorMessage } from '@/lib/api/errors';
import {
  specialistsApi,
  type SpecialistItem,
  type UpdateSpecialistPayload,
} from '@/lib/api/specialists';
import { usersApi } from '@/lib/api/users';
import { tenantsApi } from '@/lib/api/tenants';
import { useAuthStore } from '@/lib/stores/auth';
import { formatDate } from '@/lib/utils/format-date';
import { faDigits } from '@/lib/utils/persian';
import { cn } from '@/lib/utils/cn';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function SpecialistsPage() {
  const t = useTranslations('specialists');
  const tCommon = useTranslations('common');
  const tActions = useTranslations('specialists.actions');
  const tConfirm = useTranslations('specialists.confirm');
  const tCreate = useTranslations('specialists.create');
  const tEdit = useTranslations('specialists.edit');
  const tErrors = useTranslations('errors');
  const tUsers = useTranslations('users');
  const locale = useLocale();
  const qc = useQueryClient();
  const { toast } = useToast();

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [tenantId, setTenantId] = useState<string>(user?.tenantId ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [newCommission, setNewCommission] = useState('');
  const [newMobile, setNewMobile] = useState(false);

  const [editTarget, setEditTarget] = useState<SpecialistItem | null>(null);
  const [editBio, setEditBio] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editMobile, setEditMobile] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<SpecialistItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const tenantsQuery = useQuery({
    queryKey: ['admin-tenants-for-specialists'],
    queryFn: () => tenantsApi.listTenants({ limit: 100 }),
    enabled: !tenantId,
  });

  const tenantOptions: SelectOption[] = useMemo(
    () => (tenantsQuery.data?.data ?? []).map((x) => ({ value: x.id, label: x.name })),
    [tenantsQuery.data],
  );

  const specQuery = useQuery({
    queryKey: ['specialists', tenantId],
    queryFn: () => specialistsApi.getSpecialists(tenantId),
    enabled: Boolean(tenantId),
  });

  const specialists = useMemo(() => specQuery.data ?? [], [specQuery.data]);

  const usersQuery = useQuery({
    queryKey: ['admin-users-for-specialists'],
    queryFn: () => usersApi.listUsers({ status: 'all', page: 1 }),
    staleTime: 60_000,
  });

  const usersById = useMemo(() => {
    const m = new Map<string, { fullName: string | null; phoneNumber: string; tenantId: string | null }>();
    for (const u of usersQuery.data?.data ?? []) {
      m.set(u.id, { fullName: u.fullName, phoneNumber: u.phoneNumber, tenantId: u.tenantId });
    }
    return m;
  }, [usersQuery.data]);

  const filtered = useMemo(() => {
    let out = specialists;
    if (statusFilter === 'active') out = out.filter((s) => s.isActive);
    if (statusFilter === 'inactive') out = out.filter((s) => !s.isActive);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((s) => {
        const u = usersById.get(s.userId);
        return (
          (u?.fullName ?? '').toLowerCase().includes(q) ||
          (u?.phoneNumber ?? '').includes(q)
        );
      });
    }
    return out;
  }, [specialists, statusFilter, search, usersById]);

  const availableUsers: SelectOption[] = useMemo(() => {
    if (!usersQuery.data) return [];
    const already = new Set(specialists.map((s) => s.userId));
    return usersQuery.data.data
      .filter((u) => u.tenantId === tenantId && !already.has(u.id))
      .map((u) => ({
        value: u.id,
        label: u.fullName ? `${u.fullName} - ${u.phoneNumber}` : u.phoneNumber,
      }));
  }, [usersQuery.data, specialists, tenantId]);

  const createMutation = useMutation({
    mutationFn: () =>
      specialistsApi.createSpecialist({
        userId: newUserId,
        tenantId,
        bio: newBio.trim() || undefined,
        skills: newSkills
          ? newSkills.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        commissionRate: newCommission ? Number(newCommission) : undefined,
      }),
    onSuccess: () => {
      toast({ title: tCreate('createdToast'), variant: 'success' });
      setCreateOpen(false);
      resetCreate();
      void qc.invalidateQueries({ queryKey: ['specialists', tenantId] });
    },
    onError: (e) =>
      toast({ title: getApiErrorMessage(e, tCreate('actionFailed')) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSpecialistPayload }) =>
      specialistsApi.updateSpecialist(id, payload, tenantId),
    onSuccess: () => {
      toast({ title: tEdit('saved'), variant: 'success' });
      setEditTarget(null);
      void qc.invalidateQueries({ queryKey: ['specialists', tenantId] });
    },
    onError: (e) =>
      toast({ title: getApiErrorMessage(e, tEdit('saveFailed')) }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      specialistsApi.updateSpecialist(id, { isActive }, tenantId),
    onSuccess: () => {
      toast({ title: tEdit('saved'), variant: 'success' });
      setToggleTarget(null);
      void qc.invalidateQueries({ queryKey: ['specialists', tenantId] });
    },
    onError: (e) =>
      toast({ title: getApiErrorMessage(e, tActions('actionFailed')) }),
  });

  function resetCreate() {
    setNewUserId('');
    setNewBio('');
    setNewSkills('');
    setNewCommission('');
    setNewMobile(false);
  }

  function openEdit(s: SpecialistItem) {
    setEditTarget(s);
    setEditBio(s.bio ?? '');
    setEditSkills(s.skills.join(', '));
    setEditCommission(String(Number(s.commissionRate)));
    setEditMobile(s.offersMobileService);
  }

  if (!tenantId) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Card>
          {tenantsQuery.isLoading ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-line/40" aria-hidden />
              ))}
            </div>
          ) : (
            <div className="flex max-w-md flex-col gap-4">
              <Select
                label={tUsers('detail.tenantLabel')}
                value={tenantId}
                onValueChange={setTenantId}
                options={tenantOptions}
                placeholder={tUsers('detail.tenantPlaceholder')}
              />
            </div>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {isAdmin ? (
            <div className="min-w-64 flex-1">
              <Select
                label={tUsers('detail.tenantLabel')}
                value={tenantId}
                onValueChange={setTenantId}
                options={tenantOptions}
                placeholder={tUsers('detail.tenantPlaceholder')}
              />
            </div>
          ) : null}
          <div className="min-w-64 flex-1">
            <Input
              label={t('searchLabel')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'active', 'inactive'] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={statusFilter === v ? 'primary' : 'secondary'}
                onClick={() => setStatusFilter(v)}
              >
                {t(`filters.${v}`)}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('newSpecialist')}
          </Button>
        </div>

        {specQuery.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-line/40" aria-hidden />
            ))}
          </div>
        ) : specQuery.isError || !specQuery.data ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{tErrors('generic')}</CardTitle>
              <p className="mt-1 text-caption text-ink-muted">
                {getApiErrorMessage(specQuery.error, tErrors('generic'))}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => void specQuery.refetch()}
              disabled={specQuery.isFetching}
            >
              {specQuery.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-right">
              <thead>
                <tr className="border-b border-line text-overline text-ink-muted">
                  <th className="px-3 py-2.5 font-medium">{t('table.name')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('table.phone')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('table.commissionRate')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('table.status')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('table.mobileService')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('table.date')}</th>
                  <th className="px-3 py-2.5 font-medium" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((item) => {
                  const u = usersById.get(item.userId);
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'transition-colors hover:bg-cream/40',
                        !item.isActive && 'opacity-60',
                      )}
                    >
                      <td className="max-w-56 truncate px-3 py-3 text-body font-semibold text-ink">
                        {u?.fullName ?? (u ? faDigits(u.phoneNumber) : item.userId.slice(0, 8))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink" dir="ltr">
                        {u ? faDigits(u.phoneNumber) : '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink">
                        {faDigits(String(Number(item.commissionRate)))}%
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={item.isActive ? 'success' : 'error'}>
                          {item.isActive ? t('statusActive') : t('statusInactive')}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        {item.offersMobileService ? (
                          <Check className="h-4 w-4 text-success" aria-hidden />
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink-muted">
                        {formatDate(item.createdAt, locale)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" aria-hidden />
                            {tActions('edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant={item.isActive ? 'danger' : 'primary'}
                            disabled={toggleMutation.isPending && toggleTarget?.id === item.id}
                            onClick={() => setToggleTarget(item)}
                          >
                            {item.isActive ? (
                              <Ban className="h-4 w-4" aria-hidden />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" aria-hidden />
                            )}
                            {item.isActive ? tActions('deactivate') : tActions('activate')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending) {
            setCreateOpen(false);
            resetCreate();
          }
        }}
        title={tCreate('title')}
        description={tCreate('subtitle')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                resetCreate();
              }}
              disabled={createMutation.isPending}
            >
              {tCreate('cancel')}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newUserId || createMutation.isPending}
            >
              {createMutation.isPending ? tCommon('loading') : tCreate('submit')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label={tCreate('userIdLabel')}
            value={newUserId}
            onValueChange={setNewUserId}
            options={availableUsers}
            placeholder={
              availableUsers.length === 0 ? t('empty') : tCreate('userIdPlaceholder')
            }
          />
          <Input
            label={tCreate('bioLabel')}
            value={newBio}
            onChange={(e) => setNewBio(e.target.value)}
          />
          <Input
            label={tCreate('skillsLabel')}
            value={newSkills}
            onChange={(e) => setNewSkills(e.target.value)}
            placeholder={tCreate('skillsPlaceholder')}
          />
          <Input
            label={tCreate('commissionRateLabel')}
            value={newCommission}
            onChange={(e) => setNewCommission(e.target.value)}
            numeric
            type="number"
            min={0}
            max={100}
          />
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              checked={newMobile}
              onChange={(e) => setNewMobile(e.target.checked)}
            />
            {tCreate('mobileServiceLabel')}
          </label>
        </div>
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open && !updateMutation.isPending) setEditTarget(null);
        }}
        title={tEdit('title')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditTarget(null)}
              disabled={updateMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() =>
                editTarget &&
                updateMutation.mutate({
                  id: editTarget.id,
                  payload: {
                    bio: editBio.trim() || undefined,
                    skills: editSkills
                      ? editSkills.split(',').map((s) => s.trim()).filter(Boolean)
                      : undefined,
                    commissionRate: editCommission ? Number(editCommission) : undefined,
                    offersMobileService: editMobile,
                  },
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? tCommon('loading') : tEdit('save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label={tEdit('bioLabel')}
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
          />
          <Input
            label={tEdit('skillsLabel')}
            value={editSkills}
            onChange={(e) => setEditSkills(e.target.value)}
            placeholder={tEdit('skillsPlaceholder')}
          />
          <Input
            label={tEdit('commissionRateLabel')}
            value={editCommission}
            onChange={(e) => setEditCommission(e.target.value)}
            numeric
            type="number"
            min={0}
            max={100}
          />
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              checked={editMobile}
              onChange={(e) => setEditMobile(e.target.checked)}
            />
            {tEdit('mobileServiceLabel')}
          </label>
        </div>
      </Dialog>

      <Dialog
        open={toggleTarget !== null}
        onOpenChange={(open) => {
          if (!open && !toggleMutation.isPending) setToggleTarget(null);
        }}
        title={toggleTarget?.isActive ? tConfirm('deactivateTitle') : tConfirm('activateTitle')}
        description={
          toggleTarget?.isActive
            ? tConfirm('deactivateDescription')
            : tConfirm('activateDescription')
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setToggleTarget(null)}
              disabled={toggleMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant={toggleTarget?.isActive ? 'danger' : 'primary'}
              disabled={toggleMutation.isPending}
              onClick={() =>
                toggleTarget &&
                toggleMutation.mutate({
                  id: toggleTarget.id,
                  isActive: !toggleTarget.isActive,
                })
              }
            >
              {toggleMutation.isPending
                ? tCommon('loading')
                : toggleTarget?.isActive
                  ? tConfirm('deactivateConfirm')
                  : tConfirm('activateConfirm')}
            </Button>
          </>
        }
      >
        {toggleTarget ? (
          <p className="text-body text-ink" dir="ltr">
            {(() => {
              const u = usersById.get(toggleTarget.userId);
              return u ? faDigits(u.phoneNumber) : toggleTarget.userId.slice(0, 8);
            })()}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}