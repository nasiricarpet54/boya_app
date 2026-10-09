'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Link } from '@/lib/navigation';

import { UserCreateForm } from './components/UserCreateForm';

/**
 * "New user" page — a thin shell around `UserCreateForm`, mirroring the
 * `tenants/create` page: the page owns the back link and header so the form
 * stays purely about the create flow.
 */
export default function CreateUserPage() {
  const t = useTranslations('users');
  const tc = useTranslations('users.create');

  return (
    <>
      <Link
        href="/users"
        className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-caption font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
        {tc('back')}
      </Link>

      <PageHeader title={t('newUser')} subtitle={tc('subtitle')} />

      <UserCreateForm />
    </>
  );
}
