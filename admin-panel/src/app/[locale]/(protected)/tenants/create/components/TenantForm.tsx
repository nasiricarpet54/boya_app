'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/providers/ToastProvider';
import { Link } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { invitesApi } from '@/lib/api/invites';
import { tenantsApi, type CreatedTenant } from '@/lib/api/tenants';

const PHONE_RE = /^09[0-9]{9}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Result of the two-step flow: the salon plus the owner's one-time token. */
interface OnboardingResult {
  tenant: CreatedTenant;
  token: string;
  ownerPhone: string;
}

/**
 * Two-step salon onboarding (ADR-010 steps 1-2).
 *
 * Step 1 is `POST /tenants`: the admin names the salon and picks its slug.
 * Step 2 is `POST /auth/invite` with `role: 'salon_owner'`, bound to the id the
 * create call just returned — the admin has no salon, so they must name one,
 * which is exactly the id in hand.
 *
 * The two calls are deliberately sequential and not one backend endpoint: a
 * salon exists independently of its owner (an admin may create it and invite
 * later), and an invite is meaningful only against a tenant that already exists
 * (the FK). Chaining them here keeps that ordering visible instead of hiding it
 * in a transaction the user cannot see.
 *
 * Failure handling: if step 1 succeeds but step 2 fails, the salon is real and
 * the admin is told to retry the invite from the invites page — the form does
 * not pretend the whole thing rolled back.
 */
export function TenantForm() {
  const t = useTranslations('tenants.create');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Non-null means the flow succeeded and the one-time token is on screen.
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setName('');
    setSlug('');
    setOwnerName('');
    setOwnerPhone('');
    setFormError(null);
    setResult(null);
    setCopied(false);
  };

  const submit = async () => {
    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanPhone = ownerPhone.trim();

    if (cleanName.length < 2) {
      setFormError(t('nameRequired'));
      return;
    }
    if (!SLUG_RE.test(cleanSlug)) {
      setFormError(t('slugInvalid'));
      return;
    }
    if (!cleanPhone) {
      setFormError(t('ownerPhoneRequired'));
      return;
    }
    if (!PHONE_RE.test(cleanPhone)) {
      setFormError(t('ownerPhoneInvalid'));
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const tenant = await tenantsApi.createTenant({ name: cleanName, slug: cleanSlug });
      const invite = await invitesApi.createInvite({
        role: 'salon_owner',
        phone: cleanPhone,
        tenantId: tenant.id,
      });
      setResult({ tenant, token: invite.token, ownerPhone: cleanPhone });
      toast({ title: t('createdToast'), variant: 'success' });
    } catch (error) {
      // Surfaces the backend message verbatim: a duplicate slug is a 409 whose
      // text ("this slug is taken") is what the admin needs to act on.
      toast({ title: getApiErrorMessage(error, t('actionFailed')), variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyToken = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.token);
      setCopied(true);
    } catch {
      toast({ title: t('copyFailed'), variant: 'error' });
    }
  };

  // Step 2 screen: the secret exists only here, so the form is replaced rather
  // than cleared, and the admin keeps a path to the new salon.
  if (result) {
    return (
      <Card>
        <CardTitle>{t('inviteTitle')}</CardTitle>
        <CardCaption className="mt-1">{t('inviteDescription')}</CardCaption>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-cream/40 px-4 py-3">
            <code className="ltr-nums select-all break-all text-caption text-ink" dir="ltr">
              {result.token}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyToken()}
              aria-label={copied ? t('copied') : t('copy')}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>

          <CardCaption>{t('invitePhoneNote', { phone: result.ownerPhone })}</CardCaption>

          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/tenants/${result.tenant.id}`}
              className="inline-flex h-12 items-center rounded-md bg-brand-copper px-4 text-body font-semibold text-white transition-colors hover:bg-brand-copper-hover"
            >
              {t('goToTenant')}
            </Link>
            <Button variant="secondary" onClick={resetForm}>
              {t('createAnother')}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>{t('detailsTitle')}</CardTitle>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label={t('nameLabel')}
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
          <Input
            label={t('slugLabel')}
            placeholder={t('slugPlaceholder')}
            hint={t('slugHint')}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            dir="ltr"
            disabled={submitting}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>{t('ownerTitle')}</CardTitle>
        <CardCaption className="mt-1">{t('ownerDescription')}</CardCaption>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label={t('ownerNameLabel')}
            placeholder={t('ownerNamePlaceholder')}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            disabled={submitting}
          />
          <Input
            label={t('ownerPhoneLabel')}
            placeholder={t('ownerPhonePlaceholder')}
            hint={t('ownerPhoneHint')}
            numeric
            inputMode="tel"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            disabled={submitting}
          />
        </div>
      </Card>

      {formError ? <p className="text-caption text-error">{formError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
        <Link
          href="/tenants"
          className="inline-flex h-12 items-center rounded-md border border-brand-copper px-4 text-body font-semibold text-ink transition-colors hover:bg-brand-subtle"
        >
          {t('cancel')}
        </Link>
      </div>
    </div>
  );
}
