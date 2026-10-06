'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { getApiErrorMessage } from '@/lib/api/errors';
import { invitesApi, type InviteRole, type PendingInvite } from '@/lib/api/invites';
import { tenantsApi } from '@/lib/api/tenants';

import { InviteCreateDialog } from './components/InviteCreateDialog';
import { InviteTable } from './components/InviteTable';

export default function InvitesPage() {
  const t = useTranslations('invites');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The salon scope. Listing and revoking are both per-salon calls, so the
  // page picks one salon up front and everything else follows it.
  const [tenantId, setTenantId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const tenantsQuery = useQuery({
    queryKey: ['admin-tenants', 'invite-filter'],
    queryFn: () => tenantsApi.listTenants({ limit: 100 }),
  });

  const tenantOptions = useMemo(
    () =>
      (tenantsQuery.data?.data ?? []).map((tenant) => ({
        value: tenant.id,
        label: tenant.name,
      })),
    [tenantsQuery.data],
  );

  // Default to the first salon once the list lands; the admin must still be
  // able to change it, since every invite API call names a salon explicitly.
  useEffect(() => {
    if (!tenantId && tenantOptions.length > 0) {
      setTenantId(tenantOptions[0].value);
    }
  }, [tenantId, tenantOptions]);

  const listQuery = useQuery({
    queryKey: ['admin-invites', tenantId],
    queryFn: () => invitesApi.listInvites(tenantId),
    enabled: tenantId.length > 0,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-invites', tenantId] });

  const revokeMutation = useMutation({
    mutationFn: (invite: PendingInvite) => invitesApi.revokeInvite(invite.id, tenantId),
    onMutate: (invite) => setRevokingId(invite.id),
    onSettled: () => setRevokingId(null),
    onSuccess: async () => {
      await refresh();
      toast({ title: t('revokedToast'), variant: 'success' });
    },
    onError: (error) => toast({ title: getApiErrorMessage(error, t('actionFailed')), variant: 'error' }),
  });

  const roleLabels: Record<InviteRole, string> = {
    salon_owner: t('roles.salon_owner'),
    line_manager: t('roles.line_manager'),
    specialist: t('roles.specialist'),
  };

  const tableHeaders = {
    contact: t('table.contact'),
    role: t('table.role'),
    expiresAt: t('table.expiresAt'),
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={!tenantId}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('create')}
        </Button>
      </div>

      <Card className="mb-4">
        <Select
          label={t('tenantLabel')}
          value={tenantId}
          onValueChange={setTenantId}
          options={tenantOptions}
          placeholder={tenantsQuery.isLoading ? tCommon('loading') : t('tenantPlaceholder')}
        />
      </Card>

      {listQuery.isLoading ? (
        <Card>
          <div className="flex flex-col gap-2 py-8" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-cream/60" aria-hidden />
            ))}
          </div>
        </Card>
      ) : listQuery.isError || !listQuery.data ? (
        <Card>
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{tErrors('generic')}</CardTitle>
              <CardCaption className="mt-1">
                {getApiErrorMessage(listQuery.error, tErrors('generic'))}
              </CardCaption>
            </div>
            <Button
              variant="secondary"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              {listQuery.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        </Card>
      ) : (
        <InviteTable
          items={listQuery.data}
          roleLabels={roleLabels}
          headers={tableHeaders}
          revokingId={revokingId}
          onRevoke={(invite) => revokeMutation.mutate(invite)}
          emptyLabel={t('empty')}
        />
      )}

      <InviteCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultTenantId={tenantId}
        roleLabels={roleLabels}
        t={(key) => t(key)}
        onCreated={() => void refresh()}
      />
    </>
  );
}
