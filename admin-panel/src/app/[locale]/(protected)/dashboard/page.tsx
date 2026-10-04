'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Building2, CalendarCheck, ClipboardCheck, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardCaption, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { dashboardApi } from '@/lib/api/dashboard';
import { getApiErrorMessage } from '@/lib/api/errors';
import { faCurrency, faDigits } from '@/lib/utils/persian';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  // The one place the panel polls a report on a schedule. `retry: 1` and the
  // global `refetchOnWindowFocus: false` keep a flaky network from spinning.
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => dashboardApi.getDashboard(),
  });

  const stats = dashboard?.stats;
  const weeklyBookings = dashboard?.weeklyBookings ?? [];

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-[104px] animate-pulse rounded-lg bg-surface shadow-1"
              aria-hidden
            />
          ))}
        </div>

        <Card className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{t('chartTitle')}</CardTitle>
              <CardCaption>{t('chartSubtitle')}</CardCaption>
            </div>
          </div>

          <div className="h-64 animate-pulse rounded-lg bg-line/40" aria-hidden />
        </Card>
      </>
    );
  }

  if (isError || !stats) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />

        <Card className="mt-6">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{t('errorTitle')}</CardTitle>
              <CardCaption className="mt-1">
                {getApiErrorMessage(error, tErrors('generic'))}
              </CardCaption>
            </div>

            <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const chartData = weeklyBookings.map((entry) => ({
    day: entry.day,
    bookings: entry.count,
  }));

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('stats.tenants')} value={stats.activeTenants} icon={Building2} />
        <StatCard label={t('stats.approvals')} value={stats.pendingApprovals} icon={ClipboardCheck} />
        <StatCard label={t('stats.bookings')} value={stats.totalBookings} icon={CalendarCheck} />
        <StatCard
          label={t('stats.revenue')}
          value={faCurrency(stats.totalRevenue)}
          icon={Wallet}
        />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t('chartTitle')}</CardTitle>
            <CardCaption>{t('chartSubtitle')}</CardCaption>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('chartEmpty')}</p>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                {/*
                  Week columns run right-to-left in the product calendar
                  (ش، ی، د، س، چ، پ، ج), so the value axis moves to the right and
                  the category axis is reversed. The labels themselves stay
                  RTL inside their own cells.
                */}
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-line))" vertical={false} />
                <XAxis dataKey="day" reversed tickLine={false} axisLine={false} />
                <YAxis orientation="right" tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'rgb(var(--color-brand-subtle))' }}
                  contentStyle={{
                    background: 'rgb(var(--color-surface))',
                    border: '1px solid rgb(var(--color-line))',
                    borderRadius: 12,
                    fontSize: 14,
                  }}
                  formatter={(value: number) => [faDigits(value), '']}
                />
                <Bar dataKey="bookings" fill="rgb(var(--color-brand-copper))" radius={8} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
