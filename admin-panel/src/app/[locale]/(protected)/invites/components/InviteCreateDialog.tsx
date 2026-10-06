'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { getApiErrorMessage } from '@/lib/api/errors';
import { invitesApi, INVITE_ROLES, type InviteRole } from '@/lib/api/invites';
import { tenantsApi } from '@/lib/api/tenants';

interface InviteCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected salon (the list page's filter); editable while creating. */
  defaultTenantId: string;
  roleLabels: Record<InviteRole, string>;
  t: (key: string) => string;
  onCreated: () => void;
}

const PHONE_RE = /^09[0-9]{9}$/;

/**
 * Create-invite dialog with a two-phase lifecycle.
 *
 * Phase 1 is the form (role, contact, salon). Phase 2 shows the secret the
 * backend just returned: the plaintext token exists *only* in this response,
 * so the dialog deliberately stays open on it until the admin presses "copied"
 * — closing early would burn the only copy before anyone sends it.
 */
export function InviteCreateDialog({
  open,
  onOpenChange,
  defaultTenantId,
  roleLabels,
  t,
  onCreated,
}: InviteCreateDialogProps) {
  const { toast } = useToast();

  const [role, setRole] = useState<InviteRole>('specialist');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The one-time secret. Non-null means "phase 2".
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset both phases whenever the dialog (re)opens; track the salon filter.
  useEffect(() => {
    if (open) {
      setRole('specialist');
      setPhone('');
      setEmail('');
      setTenantId(defaultTenantId);
      setFormError(null);
      setSaving(false);
      setIssuedToken(null);
      setCopied(false);
    }
  }, [open, defaultTenantId]);

  // Salon source: the existing list endpoint, capped at 100 — same pattern as
  // the user role-dialog in `users/[id]`. Not fetched while the phase-2
  // secret is showing (no dropdown visible, no fetch needed).
  const tenantsQuery = useQuery({
    queryKey: ['admin-tenants', 'invite-dialog'],
    queryFn: () => tenantsApi.listTenants({ limit: 100 }),
    enabled: open && issuedToken === null,
  });

  const tenantOptions: SelectOption[] = (tenantsQuery.data?.data ?? []).map((tenant) => ({
    value: tenant.id,
    label: tenant.name,
  }));

  const submit = async () => {
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (!cleanPhone && !cleanEmail) {
      setFormError(t('contactRequired'));
      return;
    }
    if (cleanPhone && !PHONE_RE.test(cleanPhone)) {
      setFormError(t('phoneInvalid'));
      return;
    }
    if (!tenantId) {
      setFormError(t('tenantRequired'));
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const issued = await invitesApi.createInvite({
        role,
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        tenantId,
      });
      // Phase 2: hold the dialog open on the secret.
      setIssuedToken(issued.token);
      onCreated();
    } catch (error) {
      toast({ title: getApiErrorMessage(error, t('actionFailed')), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    if (!issuedToken) return;
    try {
      await navigator.clipboard.writeText(issuedToken);
      setCopied(true);
    } catch {
      toast({ title: t('copyFailed'), variant: 'error' });
    }
  };

  const closeAfterCopy = () => {
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Phase 2 must not be escaped by backdrop/X: the secret would be lost.
        if (issuedToken && next === false) return;
        onOpenChange(next);
      }}
      title={issuedToken ? t('issuedTitle') : t('createTitle')}
      description={issuedToken ? t('issuedDescription') : t('createDescription')}
    >
      {issuedToken ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-cream/60 p-3">
            <p className="text-overline text-ink-muted">{t('tokenLabel')}</p>
            {/* Raw hex on purpose: `faDigits` only converts 0-9, but a copied
                token must round-trip byte-exact — Persian digits would need
                `toLatinDigits` on the consumer and `a-f` must never shift. */}
            <p className="mt-1 break-all text-body font-semibold text-ink" dir="ltr">
              {issuedToken}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void copyToken()}>
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? t('copied') : t('copy')}
            </Button>
            <Button variant="primary" size="sm" disabled={!copied} onClick={closeAfterCopy}>
              {t('copiedClose')}
            </Button>
          </div>

          {!copied ? <p className="text-caption text-ink-muted">{t('copyFirst')}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Select
            label={t('roleLabel')}
            value={role}
            onValueChange={(value) => setRole(value as InviteRole)}
            options={INVITE_ROLES.map((value) => ({ value, label: roleLabels[value] }))}
          />

          <Input
            label={t('phoneLabel')}
            placeholder={t('phonePlaceholder')}
            value={phone}
            numeric
            onChange={(e) => setPhone(e.target.value)}
            hint={t('phoneHint')}
          />

          <Input
            label={t('emailLabel')}
            placeholder={t('emailPlaceholder')}
            value={email}
            dir="ltr"
            onChange={(e) => setEmail(e.target.value)}
          />

          <Select
            label={t('tenantLabel')}
            value={tenantId}
            onValueChange={setTenantId}
            options={tenantOptions}
            placeholder={tenantsQuery.isLoading ? t('loading') : t('tenantPlaceholder')}
          />

          {formError ? <p className="text-caption text-error">{formError}</p> : null}

          <div className="flex justify-start gap-2 pt-1">
            <Button variant="primary" onClick={() => void submit()} disabled={saving}>
              {saving ? t('saving') : t('createAction')}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
