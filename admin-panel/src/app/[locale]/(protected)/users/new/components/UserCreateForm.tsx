'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { Link, useRouter } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { usersApi } from '@/lib/api/users';
import { tenantsApi } from '@/lib/api/tenants';
import type { UserRole } from '@/lib/stores/auth';
import { isValidPhone, normalizePhone } from '@/lib/utils/persian';

const ALL_ROLES: UserRole[] = ['customer', 'salon_owner', 'line_manager', 'specialist', 'admin'];
/**
 * Roles that must belong to a salon — the backend rejects these without a
 * `tenantId` (400), so the form shows the salon dropdown for exactly this set.
 * `line_manager` is included even though the brief named only specialist and
 * salon_owner: omitting it would make the form submit a guaranteed-400 payload.
 */
const TENANT_ROLES: UserRole[] = ['salon_owner', 'line_manager', 'specialist'];

/**
 * Create-user form (mirrors `tenants/create`).
 *
 * The account has no password: the backend mints a bare user row and the new
 * user activates it through the normal OTP sign-in, so "create" here is purely
 * provisioning the phone + role (+ salon). On success we jump straight to the
 * new user's detail page using the id the POST returns.
 */
export function UserCreateForm() {
  const t = useTranslations('users');
  const tc = useTranslations('users.create');
  const router = useRouter();
  const { toast } = useToast();

  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [fullName, setFullName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Salon source, fetched only once a tenant-scoped role is picked.
  const needsTenant = TENANT_ROLES.includes(role);
  const tenantsQuery = useQuery({
    queryKey: ['admin-tenants', 'create-user'],
    queryFn: () => tenantsApi.listTenants({ limit: 100 }),
    enabled: needsTenant,
  });

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

  const submit = async () => {
    const cleanPhone = phone.trim();
    const cleanName = fullName.trim();

    if (!cleanPhone) {
      setFormError(tc('phoneRequired'));
      return;
    }
    if (!isValidPhone(cleanPhone)) {
      setFormError(tc('phoneInvalid'));
      return;
    }
    if (needsTenant && !tenantId) {
      setFormError(tc('tenantRequired'));
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const created = await usersApi.createUser({
        phone: normalizePhone(cleanPhone),
        role,
        fullName: cleanName || undefined,
        tenantId: needsTenant ? tenantId : undefined,
      });
      toast({ title: tc('createdToast'), variant: 'success' });
      router.push(`/users/${created.id}`);
    } catch (error) {
      setFormError(getApiErrorMessage(error, tc('actionFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>{t('title')}</CardTitle>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label={tc('phoneLabel')}
            placeholder={tc('phonePlaceholder')}
            hint={tc('phoneHint')}
            numeric
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
          />

          <Select
            label={tc('roleLabel')}
            value={role}
            onValueChange={(value) => {
              setRole(value as UserRole);
              // Clear a stale salon when switching to a tenant-free role.
              setTenantId('');
              setFormError(null);
            }}
            options={ALL_ROLES.map((value) => ({ value, label: roleLabels[value] }))}
          />

          {needsTenant ? (
            <Select
              label={tc('tenantLabel')}
              value={tenantId}
              onValueChange={(value) => {
                setTenantId(value);
                setFormError(null);
              }}
              options={tenantOptions}
              placeholder={tenantsQuery.isLoading ? tc('loading') : tc('tenantPlaceholder')}
            />
          ) : null}

          <Input
            label={tc('nameLabel')}
            placeholder={tc('namePlaceholder')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
          />
        </div>
      </Card>

      {formError ? <p className="text-caption text-error">{formError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? tc('submitting') : tc('submit')}
        </Button>
        <Link
          href="/users"
          className="inline-flex h-12 items-center rounded-md border border-brand-copper px-4 text-body font-semibold text-ink transition-colors hover:bg-brand-subtle"
        >
          {tc('cancel')}
        </Link>
      </div>
    </div>
  );
}
