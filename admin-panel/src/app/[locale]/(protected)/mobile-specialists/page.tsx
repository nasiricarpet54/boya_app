'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { useLocale, useTranslations } from 'next-intl';

export default function MobileSpecialistsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations();

  return (
    <>
      <PageHeader title={t('nav.mobileSpecialists')} subtitle={t('placeholder.description')} />
      <PlaceholderPage
        description={t('placeholder.description')}
        statusLabel={t('placeholder.title')}
      />
    </>
  );
}
