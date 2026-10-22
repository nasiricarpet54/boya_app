'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Ban, CheckCircle2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { Link } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { usersApi, type UserListItem, type UserStatusFilter } from '@/lib/api/users';
import { tenantsApi } from '@/lib/api/tenants';
import { useAuthStore, type UserRole } from '@/lib/stores/auth';
import { formatDate } from '@/lib/utils/format-date';
import { faDigits, faNumber } from '@/lib/utils/persian';
import { cn } from '@/lib/utils/cn';

const ROLE_FILTERS: Array<UserRole | 'all'> = [
  'all',
  'customer',
  'salon_owner',
  'line_manager',
  'specialist',
  'admin',
];
const STATUS_FILTERS: UserStatusFilter[] = ['all', 'active', 'inactive'];
const ALL_ROLES: UserRole[] = ['customer', 'salon_owner', 'line_manager', 'specialist', 'admin'];
/** Roles bound to a tenant — the role dialog shows the salon dropdown for these. */
const TENANT_ROLES: UserRole[] = ['salon_owner', 'line_manager', 'specialist'];

function roleTone(role: UserRole): BadgeTone {
  if (role === 'admin') return 'brand';
  if (role === 'salon_owner') return 'info';
  if (role === 'line_manager') return 'info';
  if (role === 'specialist') return 'success';
  return 'neutral';
}

export default function UsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('active');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounced so typing a phone number does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ['admin-users', { search, role: roleFilter, status: statusFilter, page }],
    queryFn: () =>
      usersApi.listUsers({
        search: search || undefined,
        role: roleFilter,
        status: statusFilter,
        page,
      }),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  const currentPage = query.data?.page ?? page;

  const roleLabels: Record<UserRole, string> = {
    customer: t('filters.customer'),
    salon_owner: t('filters.salon_owner'),
    line_manager: t('filters.line_manager'),
    specialist: t('filters.specialist'),
    admin: t('filters.admin'),
  };

  const tActions = useTranslations('users.actions');
  const tConfirm = useTranslations('users.confirm');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = useLocale();

  // The signed-in admin: the backend refuses self role/status/delete changes, so
  // this row shows only the edit link (an admin cannot act on their own account
  // here — a second admin must do it).
  const currentUserId = useAuthStore((state) => state.user?.id);

  // Role-change dialog state.
  const [roleTarget, setRoleTarget] = useState<UserListItem | null>(null);
  const [nextRole, setNextRole] = useState<UserRole>('customer');
  const [nextTenantId, setNextTenantId] = useState('');
  const [tenantError, setTenantError] = useState<string | null>(null);

  // Delete-confirm state.
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);

  // Salon dropdown source for the role dialog — fetched only while it is open.
  const tenantsQuery = useQuery({
    queryKey: ['admin-tenants', 'users-list'],
    queryFn: () => tenantsApi.listTenants({ limit: 100 }),
    enabled: roleTarget !== null,
  });

  const tenantOptions: SelectOption[] = (tenantsQuery.data?.data ?? []).map((tenant) => ({
    value: tenant.id,
    label: tenant.name,
  }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) =>
      usersApi.updateStatus(v.id, { isActive: v.isActive }),
    onSuccess: async () => {
      await invalidate();
      toast({ title: tActions('statusUpdatedToast'), variant: 'success' });
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, tActions('actionFailed')), variant: 'error' }),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { id: string; role: UserRole; tenantId?: string }) =>
      usersApi.updateRole(v.id, { role: v.role, tenantId: v.tenantId }),
    onSuccess: async () => {
      setRoleTarget(null);
      await invalidate();
      toast({ title: tActions('roleUpdatedToast'), variant: 'success' });
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, tActions('actionFailed')), variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess: async () => {
      setDeleteTarget(null);
      // Soft delete only flips `is_active`: the row still matches the `all`
      // filter, so it would sit in the table looking untouched. Reset to the
      // default filter set so the deleted row disappears after the refetch.
      setStatusFilter('active');
      setPage(1);
      await invalidate();
      toast({ title: tActions('deleteToast'), variant: 'success' });
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, tActions('actionFailed')), variant: 'error' }),
  });

  const openRoleDialog = (item: UserListItem) => {
    setRoleTarget(item);
    setNextRole(item.role);
    setNextTenantId(item.tenantId ?? '');
    setTenantError(null);
  };

  const submitRole = () => {
    if (!roleTarget) return;
    if (TENANT_ROLES.includes(nextRole) && !nextTenantId) {
      setTenantError(t('detail.tenantRequired'));
      return;
    }
    roleMutation.mutate({
      id: roleTarget.id,
      role: nextRole,
      // customer/admin must clear the tenant; the backend enforces it too.
      tenantId: TENANT_ROLES.includes(nextRole) ? nextTenantId : undefined,
    });
  };

  const statusPendingId = statusMutation.isPending ? (statusMutation.variables?.id ?? null) : null;
  const rolePendingId = roleMutation.isPending ? (roleMutation.variables?.id ?? null) : null;
  const deletePendingId = deleteMutation.isPending ? (deleteMutation.variables ?? null) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title={t('title')}
          subtitle={`${faNumber(total)} ${t('countSuffix')} · ${t('subtitle')}`}
        />
        <Link
          href="/users/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-3 text-caption font-semibold text-white transition-colors hover:bg-brand-primary-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('newUser')}
        </Link>
      </div>

      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          <Input
            label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          <div role="group" aria-label={t('table.role')} className="flex flex-wrap gap-1 rounded-lg bg-cream/60 p-1">
            {ROLE_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === roleFilter}
                onClick={() => {
                  setRoleFilter(v);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-4 py-2 text-body transition-colors',
                  v === roleFilter
                    ? 'bg-surface font-semibold text-brand-primary shadow-1'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {v === 'all' ? t('filters.all') : roleLabels[v]}
              </button>
            ))}
          </div>

          <div role="group" aria-label={t('table.status')} className="flex flex-wrap gap-1 rounded-lg bg-cream/60 p-1">
            {STATUS_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === statusFilter}
                onClick={() => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-4 py-2 text-body transition-colors',
                  v === statusFilter
                    ? 'bg-surface font-semibold text-brand-primary shadow-1'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {t(`statusFilters.${v}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-3">
          <label
            className="inline-flex cursor-pointer items-center gap-2 text-body text-ink"
            title={t('softDeleteHint')}
          >
            <button
              type="button"
              role="switch"
              aria-checked={statusFilter !== 'active'}
              aria-label={t('showInactive')}
              title={t('softDeleteHint')}
              onClick={() => {
                setStatusFilter(statusFilter !== 'active' ? 'active' : 'all');
                setPage(1);
              }}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                statusFilter !== 'active' ? 'bg-brand-primary' : 'bg-line',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-1 transition-all',
                  statusFilter !== 'active' ? 'right-0.5' : 'right-[22px]',
                )}
              />
            </button>
            {t('showInactive')}
          </label>
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
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-line text-overline text-ink-muted">
                    <th className="px-3 py-2.5 font-medium">{t('table.name')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.phone')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.role')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.tenant')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.status')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.date')}</th>
                    <th className="px-3 py-2.5 font-medium" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(
                        'transition-colors hover:bg-cream/40',
                        !item.isActive && 'opacity-60',
                      )}
                    >
                      <td className="max-w-56 truncate px-3 py-3 text-body font-semibold text-ink">
                        {item.fullName ?? t('detail.noName')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink" dir="ltr">
                        {faDigits(item.phoneNumber)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={roleTone(item.role)}>{roleLabels[item.role]}</Badge>
                      </td>
                      <td className="max-w-44 truncate px-3 py-3 text-body text-ink">
                        {item.tenantName ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span title={item.isActive ? undefined : t('softDeleteHint')}>
                          <Badge tone={item.isActive ? 'success' : 'error'}>
                            {item.isActive ? t('statusActive') : t('statusInactive')}
                          </Badge>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink-muted">
                        {formatDate(item.createdAt, locale)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/users/${item.id}`}
                            aria-label={`${tActions('edit')}: ${item.phoneNumber}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-caption font-semibold text-brand-primary transition-colors hover:bg-brand-subtle"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                            {tActions('edit')}
                          </Link>

                          {/* The backend refuses self role/status/delete, so those
                              actions are hidden on the signed-in admin's own row. */}
                          {item.id !== currentUserId ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                aria-label={`${tActions('changeRole')}: ${item.phoneNumber}`}
                                disabled={rolePendingId === item.id}
                                onClick={() => openRoleDialog(item)}
                              >
                                <RefreshCw className="h-4 w-4" aria-hidden />
                                {tActions('changeRole')}
                              </Button>
                              <Button
                                size="sm"
                                variant={item.isActive ? 'danger' : 'primary'}
                                aria-label={`${item.isActive ? tActions('deactivate') : tActions('activate')}: ${item.phoneNumber}`}
                                disabled={statusPendingId === item.id}
                                onClick={() =>
                                  statusMutation.mutate({ id: item.id, isActive: !item.isActive })
                                }
                              >
                                {item.isActive ? (
                                  <Ban className="h-4 w-4" aria-hidden />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                                )}
                                {item.isActive ? tActions('deactivate') : tActions('activate')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-error hover:bg-error/10"
                                aria-label={`${tActions('delete')}: ${item.phoneNumber}`}
                                disabled={deletePendingId === item.id}
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                {tActions('delete')}
                              </Button>
                            </>
                          ) : null}
                        </div>
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
                  disabled={currentPage <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('prev')}
                </Button>
                <p className="text-caption text-ink-muted">
                  {faDigits(`${currentPage} / ${totalPages}`)}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages || query.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('next')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      {/* Role-change dialog: tenant dropdown appears for tenant-scoped roles. */}
      <Dialog
        open={roleTarget !== null}
        onOpenChange={(open) => {
          if (!open && !roleMutation.isPending) setRoleTarget(null);
        }}
        title={t('detail.changeRoleTitle')}
        description={t('detail.changeRoleDescription')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRoleTarget(null)}
              disabled={roleMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={submitRole} disabled={roleMutation.isPending}>
              {roleMutation.isPending ? tCommon('loading') : t('detail.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label={t('detail.roleLabel')}
            value={nextRole}
            onValueChange={(value) => {
              setNextRole(value as UserRole);
              setTenantError(null);
            }}
            options={ALL_ROLES.map((role) => ({ value: role, label: roleLabels[role] }))}
          />

          {TENANT_ROLES.includes(nextRole) ? (
            <Select
              label={t('detail.tenantLabel')}
              value={nextTenantId}
              onValueChange={(value) => {
                setNextTenantId(value);
                setTenantError(null);
              }}
              options={tenantOptions}
              placeholder={tenantsQuery.isLoading ? tCommon('loading') : t('detail.tenantPlaceholder')}
              error={tenantError ?? undefined}
            />
          ) : null}
        </div>
      </Dialog>

      {/* Delete-confirm dialog (soft delete). */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        title={tConfirm('deleteTitle')}
        description={tConfirm('deleteDescription')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? tCommon('loading') : tConfirm('deleteConfirm')}
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <p className="text-body text-ink" dir="ltr">
            {faDigits(deleteTarget.phoneNumber)}
            {deleteTarget.fullName ? ` — ${deleteTarget.fullName}` : ''}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}

