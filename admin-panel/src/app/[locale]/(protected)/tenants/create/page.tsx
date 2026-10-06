'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Link } from '@/lib/navigation';

import { TenantForm } from './components/TenantForm';

/**
 * "New salon" page (ADR-010 onboarding).
 *
 * A thin shell around `TenantForm`: the page owns the header and the back link
 * so the form stays purely about the two-step create + invite flow.
 */
export default function CreateTenantPage() {
  const t = useTranslations('tenants.create');

  return (
    <>
      <Link
        href="/tenants"
        className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-caption font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
        {t('back')}
      </Link>

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <TenantForm />
    </>
  );
}
