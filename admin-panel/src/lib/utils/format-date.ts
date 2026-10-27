import {
  jalaliDate,
  jalaliDateTime,
  jalaliDateWithWeekday,
  jalaliDateWithWeekdayAndMonth,
  jalaliWeekday,
} from './jalali';

export type DateInput = Date | string | number | null | undefined;

/** Product timezone — every instant renders as the Tehran civil date. */
const TEHRAN_TZ = 'Asia/Tehran';

function toValidDate(value: DateInput): Date | null {
  if (value === undefined || value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Date only: `۱۴۰۵/۰۷/۱۸` in `fa`, `Oct 18, 2026` in `en`.
 * Digits follow the locale (Persian in `fa`, Latin in `en`).
 */
export function formatDate(value: DateInput, locale: string): string {
  if (locale === 'fa') return jalaliDate(value ?? undefined);
  const date = toValidDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Date + 24-hour time: `۱۴۰۵/۰۷/۱۸، ۱۴:۳۰` in `fa`,
 * `Oct 18, 2026 14:30` in `en`.
 */
export function formatDateTime(value: DateInput, locale: string): string {
  if (locale === 'fa') return jalaliDateTime(value ?? undefined);
  const date = toValidDate(value);
  if (!date) return '';
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: TEHRAN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day} ${time}`;
}

/** Weekday name only: `شنبه` in `fa`, `Saturday` in `en`. */
export function formatWeekday(value: DateInput, locale: string): string {
  if (locale === 'fa') return jalaliWeekday(value ?? undefined);
  const date = toValidDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TZ,
    weekday: 'long',
  }).format(date);
}

/** `۱۴۰۵/۰۷/۱۸ — شنبه` in `fa`, `Saturday, Oct 18, 2026` in `en`. */
export function formatDateWithWeekday(value: DateInput, locale: string): string {
  if (locale === 'fa') return jalaliDateWithWeekday(value ?? undefined);
  const date = toValidDate(value);
  if (!date) return '';
  return `${formatWeekday(date, locale)}, ${formatDate(date, locale)}`;
}

/** `سه‌شنبه ۵ آبان ۱۴۰۵` in `fa`, `Tuesday Oct 18, 2026` in `en`. */
export function formatDateWithWeekdayAndMonth(value: DateInput, locale: string): string {
  if (locale === 'fa') return jalaliDateWithWeekdayAndMonth(value ?? undefined);
  const date = toValidDate(value);
  if (!date) return '';
  return `${formatWeekday(date, locale)} ${formatDate(date, locale).replace(/\//g, '-')}`;
}
