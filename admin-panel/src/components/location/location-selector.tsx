'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Select, type SelectOption } from '@/components/ui/Select';
import { getCities, getProvinces } from '@/lib/api/locations';
import { cn } from '@/lib/utils/cn';

/**
 * Sentinel value for the explicit "no selection" row. Radix reserves the empty
 * string for "nothing chosen", so an item can never carry it — a real value is
 * required, and it is mapped back to `undefined` on the way out.
 */
const NONE = '__none__';

export interface LocationValue {
  provinceId?: string;
  cityId?: string;
}

export interface LocationSelectorProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * The two-step Iranian province → city picker, backed by the public
 * `/locations` endpoints.
 *
 * The city list is province-scoped, so it is only fetched once a province is
 * chosen (`enabled`); before that the second select stays disabled rather than
 * offering cities the province filter would contradict. Switching province
 * resets `cityId`, since a city from the previous province can never be valid
 * under the new one — keeping a stale id would silently desync the two columns
 * the backend keeps consistent.
 *
 * Reference data is static, so both queries lean on the panel's shared
 * `staleTime` cache: every picker on a page issues one request per province.
 */
export function LocationSelector({ value, onChange, disabled, className }: LocationSelectorProps) {
  const t = useTranslations('tenants.form');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces });
  const citiesQuery = useQuery({
    queryKey: ['locations', 'cities', value.provinceId],
    queryFn: () => getCities(value.provinceId as string),
    enabled: Boolean(value.provinceId),
  });

  const localized = (fa: string, en: string): string => (locale === 'fa' ? fa : en);

  const provinceOptions: SelectOption[] = [
    { value: NONE, label: t('none') },
    ...(provincesQuery.data ?? []).map((province) => ({
      value: province.id,
      label: localized(province.nameFa, province.nameEn),
    })),
  ];

  const cityOptions: SelectOption[] = [
    { value: NONE, label: t('none') },
    ...(citiesQuery.data ?? []).map((city) => ({
      value: city.id,
      label: localized(city.nameFa, city.nameEn),
    })),
  ];

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      <Select
        label={t('province')}
        value={value.provinceId}
        onValueChange={(next) => {
          if (next === NONE) onChange({ provinceId: undefined, cityId: undefined });
          // The province drives the city list, so a change drops the old city.
          else onChange({ provinceId: next, cityId: undefined });
        }}
        options={provinceOptions}
        placeholder={provincesQuery.isLoading ? tCommon('loading') : t('selectProvince')}
        disabled={disabled}
      />
      <Select
        label={t('city')}
        value={value.cityId}
        onValueChange={(next) => onChange({ ...value, cityId: next === NONE ? undefined : next })}
        options={cityOptions}
        placeholder={
          !value.provinceId
            ? t('selectProvinceFirst')
            : citiesQuery.isLoading
              ? tCommon('loading')
              : t('selectCity')
        }
        disabled={disabled || !value.provinceId}
      />
    </div>
  );
}
