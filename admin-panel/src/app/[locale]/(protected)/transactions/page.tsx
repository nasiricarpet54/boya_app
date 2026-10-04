import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';

/**
 * Phase 1 placeholder: the charter keeps payments off the platform
 * (`PAYMENTS_ENABLED=false`) — customers pay the salon directly, so there is
 * nothing to list. The gateway button is the Phase 2 hook, kept disabled.
 */
export default async function TransactionsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('transactions');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="mb-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <CardTitle>{t('phaseTitle')}</CardTitle>
          <CardCaption>{t('phaseDescription')}</CardCaption>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-right">
            <thead>
              <tr className="border-b border-line text-overline text-ink-muted">
                <th className="px-3 py-2.5 font-medium">{t('table.date')}</th>
                <th className="px-3 py-2.5 font-medium">{t('table.tenant')}</th>
                <th className="px-3 py-2.5 font-medium">{t('table.amount')}</th>
                <th className="px-3 py-2.5 font-medium">{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="py-12 text-center text-caption text-ink-muted">
                  {t('empty')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end border-t border-line pt-4">
          <Button variant="secondary" disabled>
            {t('enableGateway')}
          </Button>
        </div>
      </Card>
    </>
  );
}

