import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/PageHeader';
import { PlaceholderPage } from '@/components/layout/PlaceholderPage';

export default async function SettingsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t('nav.settings')} subtitle={t('placeholder.description')} />
      <PlaceholderPage
        description={t('placeholder.settings')}
        statusLabel={t('placeholder.title')}
      />
    </>
  );
}
