'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Link } from '@/lib/navigation';
import { getApiErrorMessage } from '@/lib/api/errors';
import { usersApi, type UserStatusFilter } from '@/lib/api/users';
import type { UserRole } from '@/lib/stores/auth';
import { jalaliDate } from '@/lib/utils/jalali';
import { faDigits, faNumber } from '@/lib/utils/persian';
import { cn } from '@/lib/utils/cn';

const ROLE_FILTERS: Array<UserRole | 'all'> = [
  'all',
  'customer',
  'salon_owner',
  'line_manager',
  'specialist',
  'admin',
];
const STATUS_FILTERS: UserStatusFilter[] = ['all', 'active', 'inactive'];

function roleTone(role: UserRole): BadgeTone {
  if (role === 'admin') return 'brand';
  if (role === 'salon_owner') return 'info';
  if (role === 'line_manager') return 'info';
  if (role === 'specialist') return 'success';
  return 'neutral';
}

export default function UsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounced so typing a phone number does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ['admin-users', { search, role: roleFilter, status: statusFilter, page }],
    queryFn: () =>
      usersApi.listUsers({
        search: search || undefined,
        role: roleFilter,
        status: statusFilter,
        page,
      }),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  const currentPage = query.data?.page ?? page;

  const roleLabels: Record<UserRole, string> = {
    customer: t('filters.customer'),
    salon_owner: t('filters.salon_owner'),
    line_manager: t('filters.line_manager'),
    specialist: t('filters.specialist'),
    admin: t('filters.admin'),
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={`${faNumber(total)} ${t('countSuffix')} · ${t('subtitle')}`}
      />

      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          <Input
            label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          <div role="group" aria-label={t('table.role')} className="flex flex-wrap gap-1 rounded-lg bg-cream/60 p-1">
            {ROLE_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === roleFilter}
                onClick={() => {
                  setRoleFilter(v);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-4 py-2 text-body transition-colors',
                  v === roleFilter
                    ? 'bg-surface font-semibold text-brand-copper shadow-1'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {v === 'all' ? t('filters.all') : roleLabels[v]}
              </button>
            ))}
          </div>

          <div role="group" aria-label={t('table.status')} className="flex flex-wrap gap-1 rounded-lg bg-cream/60 p-1">
            {STATUS_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === statusFilter}
                onClick={() => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-4 py-2 text-body transition-colors',
                  v === statusFilter
                    ? 'bg-surface font-semibold text-brand-copper shadow-1'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {t(`statusFilters.${v}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        {query.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-line/40" aria-hidden />
            ))}
          </div>
        ) : query.isError || !query.data ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div>
              <CardTitle>{tErrors('generic')}</CardTitle>
              <p className="mt-1 text-caption text-ink-muted">
                {getApiErrorMessage(query.error, tErrors('generic'))}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? tCommon('loading') : tCommon('retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-muted">{t('empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-line text-overline text-ink-muted">
                    <th className="px-3 py-2.5 font-medium">{t('table.name')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.phone')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.role')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.tenant')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.status')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('table.date')}</th>
                    <th className="px-3 py-2.5 font-medium" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-cream/40">
                      <td className="max-w-56 truncate px-3 py-3 text-body font-semibold text-ink">
                        {item.fullName ?? t('detail.noName')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink" dir="ltr">
                        {faDigits(item.phoneNumber)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={roleTone(item.role)}>{roleLabels[item.role]}</Badge>
                      </td>
                      <td className="max-w-44 truncate px-3 py-3 text-body text-ink">
                        {item.tenantName ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={item.isActive ? 'success' : 'error'}>
                          {item.isActive ? t('statusActive') : t('statusInactive')}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-caption text-ink-muted">
                        {jalaliDate(item.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/users/${item.id}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-caption font-semibold text-brand-copper transition-colors hover:bg-brand-subtle"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                          {t('table.view')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('prev')}
                </Button>
                <p className="text-caption text-ink-muted">
                  {faDigits(`${currentPage} / ${totalPages}`)}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages || query.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('next')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

