'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowRight, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { Link, useRouter } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { usersApi, type UserDetail } from '@/lib/api/users';
import { authApi } from '@/lib/api/auth';
import { tenantsApi } from '@/lib/api/tenants';
import { useAuthStore, type UserRole } from '@/lib/stores/auth';
import { jalaliDateTime } from '@/lib/utils/jalali';
import { faCurrency, faDigits, faNumber } from '@/lib/utils/persian';

const ALL_ROLES: UserRole[] = ['customer', 'salon_owner', 'line_manager', 'specialist', 'admin'];
/** Roles bound to a tenant — the dialog shows the salon dropdown for these. */
const TENANT_ROLES: UserRole[] = ['salon_owner', 'line_manager', 'specialist'];

function roleTone(role: UserRole): BadgeTone {
  if (role === 'admin') return 'brand';
  if (role === 'salon_owner') return 'info';
  if (role === 'line_manager') return 'info';
  if (role === 'specialist') return 'success';
  return 'neutral';
}

function InfoRow({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-overline text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-body text-ink" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('users');
  const td = useTranslations('users.detail');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  // The signed-in admin: the backend refuses self status/role/delete, so those
  // actions are hidden on this page when viewing your own account.
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [roleOpen, setRoleOpen] = useState(false);
  const [nextRole, setNextRole] = useState<UserRole>('customer');
  const [nextTenantId, setNextTenantId] = useState('');
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useQuery({
    queryKey: ['admin-user', params.id],
    queryFn: () => usersApi.getUser(params.id),
  });

  // Tenant dropdown source: the existing list endpoint, capped at 100.
  // Fetched only while the dialog is open, so the list page never pays for it.
  const tenantsQuery = useQuery({
    queryKey: ['admin-tenants', 'role-dialog'],
    queryFn: () => tenantsApi.listTenants({ limit: 100 }),
    enabled: roleOpen,
  });

  const invalidate = () =>
    queryClient
      .invalidateQueries({ queryKey: ['admin-user', params.id] })
      .then(() => queryClient.invalidateQueries({ queryKey: ['admin-users'] }));

  const roleMutation = useMutation({
    mutationFn: (body: { role: UserRole; tenantId?: string }) =>
      usersApi.updateRole(params.id, body),
    onSuccess: async () => {
      setRoleOpen(false);
      await invalidate();
      toast({ title: td('roleUpdatedToast'), variant: 'success' });
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, td('actionFailed')), variant: 'error' }),
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => usersApi.updateStatus(params.id, { isActive }),
    onSuccess: async () => {
      await invalidate();
      toast({ title: td('statusUpdatedToast'), variant: 'success' });
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, td('actionFailed')), variant: 'error' }),
  });

  // Soft delete: flips is_active on the user (and their specialist row). On
  // success we bounce back to the list, since this page's subject is gone.
  const deleteMutation = useMutation({
    mutationFn: () => usersApi.deleteUser(params.id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: td('deletedToast'), variant: 'success' });
      router.push('/users');
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, td('actionFailed')), variant: 'error' }),
  });

  // Re-send the sign-in OTP to this user's phone via the public endpoint. The
  // new user activates their account with this code, so an admin can nudge it
  // when the first SMS never arrived.
  const resendOtpMutation = useMutation({
    mutationFn: (phoneNumber: string) => authApi.sendOtp(phoneNumber),
    onSuccess: () => {
      toast({ title: td('resendOtpToast'), variant: 'success' });
    },
    onError: (e) => toast({ title: getApiErrorMessage(e, td('actionFailed')), variant: 'error' }),
  });

  const openRoleDialog = (user: UserDetail) => {
    setNextRole(user.role);
    setNextTenantId(user.tenantId ?? '');
    setTenantError(null);
    setRoleOpen(true);
  };

  const submitRole = () => {
    if (TENANT_ROLES.includes(nextRole) && !nextTenantId) {
      setTenantError(td('tenantRequired'));
      return;
    }
    roleMutation.mutate({
      role: nextRole,
      // customer/admin must clear the tenant; the backend enforces it too.
      tenantId: TENANT_ROLES.includes(nextRole) ? nextTenantId : undefined,
    });
  };

  if (query.isLoading) {
    return (
      <>
        <PageHeader title={t('title')} />
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-surface shadow-1" aria-hidden />
          ))}
        </div>
      </>
    );
  }

  if (query.isError || !query.data) {
    return (
      <>
        <PageHeader title={t('title')} />
        <Card>
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{tErrors('generic')}</CardTitle>
              <CardCaption className="mt-1">
                {getApiErrorMessage(query.error, tErrors('generic'))}
              </CardCaption>
            </div>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const user = query.data;
  const roleLabels: Record<UserRole, string> = {
    customer: t('filters.customer'),
    salon_owner: t('filters.salon_owner'),
    line_manager: t('filters.line_manager'),
    specialist: t('filters.specialist'),
    admin: t('filters.admin'),
  };

  const tenantOptions: SelectOption[] = (tenantsQuery.data?.data ?? []).map((tenant) => ({
    value: tenant.id,
    label: tenant.name,
  }));

  return (
    <>
      <Link
        href="/users"
        className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-caption font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
        {td('back')}
      </Link>

      <PageHeader
        title={user.fullName ?? td('noName')}
        subtitle={faDigits(user.phoneNumber)}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={roleTone(user.role)}>{roleLabels[user.role]}</Badge>
        <Badge tone={user.isActive ? 'success' : 'error'}>
          {user.isActive ? t('statusActive') : t('statusInactive')}
        </Badge>

        <span className="ms-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openRoleDialog(user)}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {td('changeRole')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={resendOtpMutation.isPending}
            onClick={() => resendOtpMutation.mutate(user.phoneNumber)}
          >
            <Send className="h-4 w-4" aria-hidden />
            {td('resendOtp')}
          </Button>
          <Button
            size="sm"
            variant={user.isActive ? 'danger' : 'primary'}
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(!user.isActive)}
          >
            {user.isActive ? td('deactivate') : td('activate')}
          </Button>
          {/* Self role/status/delete are refused by the backend, so delete is
              hidden on the signed-in admin's own profile. */}
          {user.id !== currentUserId ? (
            <Button size="sm" variant="ghost" className="text-error hover:bg-error/10" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              {td('delete')}
            </Button>
          ) : null}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Basic info */}
        <Card>
          <CardTitle className="mb-3">{td('basicInfo')}</CardTitle>
          <dl className="grid grid-cols-2 gap-3">
            <InfoRow label={td('name')} value={user.fullName ?? td('noName')} />
            <InfoRow label={td('phone')} value={faDigits(user.phoneNumber)} ltr />
            <InfoRow label={td('role')} value={roleLabels[user.role]} />
            <InfoRow
              label={td('status')}
              value={user.isActive ? t('statusActive') : t('statusInactive')}
            />
            <InfoRow label={td('tenant')} value={user.tenantName ?? td('noTenant')} />
            <InfoRow label={td('joined')} value={jalaliDateTime(user.createdAt)} />
            <InfoRow
              label={td('lastLogin')}
              value={user.lastLoginAt ? jalaliDateTime(user.lastLoginAt) : td('noLastLogin')}
            />
          </dl>
        </Card>

        {/* Stats */}
        <Card>
          <CardTitle className="mb-3">{td('stats')}</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md bg-cream/60 p-3">
              <p className="text-overline text-ink-muted">{td('statBookings')}</p>
              <p className="mt-1 text-title font-semibold text-ink">
                {faNumber(user.bookingsCount)}
              </p>
            </div>
            <div className="rounded-md bg-cream/60 p-3">
              <p className="text-overline text-ink-muted">{td('statRole')}</p>
              <p className="mt-1 text-title font-semibold text-ink">{roleLabels[user.role]}</p>
            </div>
            <div className="rounded-md bg-cream/60 p-3">
              <p className="text-overline text-ink-muted">{td('tenant')}</p>
              <p className="mt-1 truncate text-title font-semibold text-ink">
                {user.tenantName ?? td('noTenant')}
              </p>
            </div>
          </div>
        </Card>

        {/* 5 most recent bookings — customers only. */}
        {user.role === 'customer' ? (
          <Card>
            <CardTitle className="mb-3">{td('recentBookings')}</CardTitle>
            {user.lastBookings.length === 0 ? (
              <p className="py-4 text-center text-caption text-ink-muted">{td('noBookings')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-right">
                  <thead>
                    <tr className="border-b border-line text-overline text-ink-muted">
                      <th className="px-2 py-2 font-medium">{td('bookingService')}</th>
                      <th className="px-2 py-2 font-medium">{td('bookingSpecialist')}</th>
                      <th className="px-2 py-2 font-medium">{td('bookingSalon')}</th>
                      <th className="px-2 py-2 font-medium">{td('bookingTime')}</th>
                      <th className="px-2 py-2 font-medium">{td('bookingStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {user.lastBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-2 py-2.5 text-body text-ink">
                          {booking.serviceName ?? '—'}
                          {booking.totalPrice !== null ? (
                            <span className="ms-2 text-overline text-ink-muted">
                              {faCurrency(booking.totalPrice)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-body text-ink">
                          {booking.specialistName ?? '—'}
                        </td>
                        <td className="px-2 py-2.5 text-body text-ink">
                          {booking.tenantName ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-caption text-ink-muted">
                          {jalaliDateTime(booking.startAt)}
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge tone="neutral">{booking.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}

        {/* 5 most recent audit_logs entries touching this user. */}
        <Card>
          <CardTitle className="mb-3">{td('auditTrail')}</CardTitle>
          {user.auditTrail.length === 0 ? (
            <p className="py-4 text-center text-caption text-ink-muted">{td('noAudit')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {user.auditTrail.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink" dir="ltr">
                      {entry.action}
                    </p>
                    {entry.reason ? (
                      <p className="mt-0.5 truncate text-overline text-ink-muted" dir="ltr">
                        {entry.reason}
                      </p>
                    ) : null}
                  </div>
                  <time className="whitespace-nowrap text-caption text-ink-muted">
                    {jalaliDateTime(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Role change dialog: tenant dropdown appears for tenant-scoped roles. */}
      <Dialog
        open={roleOpen}
        onOpenChange={(open) => {
          if (!open && !roleMutation.isPending) setRoleOpen(false);
        }}
        title={td('changeRoleTitle')}
        description={td('changeRoleDescription')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRoleOpen(false)}
              disabled={roleMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={submitRole} disabled={roleMutation.isPending}>
              {roleMutation.isPending ? tCommon('loading') : td('save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label={td('roleLabel')}
            value={nextRole}
            onValueChange={(value) => {
              setNextRole(value as UserRole);
              setTenantError(null);
            }}
            options={ALL_ROLES.map((role) => ({ value: role, label: roleLabels[role] }))}
          />

          {TENANT_ROLES.includes(nextRole) ? (
            <Select
              label={td('tenantLabel')}
              value={nextTenantId}
              onValueChange={(value) => {
                setNextTenantId(value);
                setTenantError(null);
              }}
              options={tenantOptions}
              placeholder={
                tenantsQuery.isLoading ? tCommon('loading') : td('tenantPlaceholder')
              }
              error={tenantError ?? undefined}
            />
          ) : null}
        </div>
      </Dialog>

      {/* Delete-confirm dialog (soft delete). */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteOpen(false);
        }}
        title={td('deleteTitle')}
        description={td('deleteDescription')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? tCommon('loading') : td('deleteConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-body text-ink" dir="ltr">
          {faDigits(user.phoneNumber)}
          {user.fullName ? ` — ${user.fullName}` : ''}
        </p>
      </Dialog>
    </>
  );
}
