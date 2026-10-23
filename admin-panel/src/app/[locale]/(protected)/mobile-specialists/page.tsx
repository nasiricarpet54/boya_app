'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { specialistsApi, type MobileSpecialist } from '@/lib/api/specialists';
import { useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';

export default function MobileSpecialistsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations();

  const { data, isLoading, error } = useQuery({
    queryKey: ['mobile-specialists'],
    queryFn: () => specialistsApi.getMobileSpecialists(),
  });

  const specialists = data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-body">در حال بارگذاری...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-body text-red-600">خطا در بارگذاری داده‌ها: {String(error)}</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t('nav.mobileSpecialists')} subtitle={t('mobileSpecialists.subtitle') || 'لیست متخصصان سیار'} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-right">
          <thead>
            <tr className="border-b border-line text-overline text-ink-muted">
              <th className="px-3 py-2.5 font-medium">{t('table.name')}</th>
              <th className="px-3 py-2.5 font-medium">{t('table.phone')}</th>
              <th className="px-3 py-2.5 font-medium">{t('table.specialty')}</th>
              <th className="px-3 py-2.5 font-medium">{t('table.city')}</th>
              <th className="px-3 py-2.5 font-medium">{t('table.status')}</th>
            </tr>
          </thead>
          <tbody>
            {specialists.map((spec: MobileSpecialist) => (
              <tr key={spec.id} className="border-b border-line">
                <td className="px-3 py-3 text-body text-ink font-medium">{spec.name}</td>
                <td className="px-3 py-3 text-body text-ink">{spec.phone}</td>
                <td className="px-3 py-3 text-body text-ink">{spec.specialty}</td>
                <td className="px-3 py-3 text-body text-ink">{spec.city}</td>
                <td className="px-3 py-3 text-body text-ink">
                  <Badge tone={spec.isActive ? 'success' : 'neutral'}>
                    {t(`table.status.${spec.isActive ? 'active' : 'inactive'}`) || (spec.isActive ? 'فعال' : 'غیرفعال')}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {specialists.length === 0 && (
          <div className="text-center text-body text-ink-muted py-8">متخصص سیاری یافت نشد</div>
        )}
      </div>
    </>
  );
}
