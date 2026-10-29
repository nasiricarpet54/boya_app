import moment from 'moment-jalaali';

import { faDigits } from './persian';

// Register Jalali month names for the `fa` locale. Without this call,
// moment-jalaali falls back to Latin transliteration for Jalali-specific
// tokens (`jMMMM` → `Aabaan`); the standard moment `fa` locale only covers
// Gregorian tokens (`dddd`, `MMMM`). Persian digits are handled separately
// by `faDigits()` in the `format` helper below, so the locale is told to
// leave digits as ASCII (single source of truth for digit conversion).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(moment as any).loadPersian({ dialect: 'persian-modern', usePersianDigits: false });

/**
 * Jalali display helpers.
 *
 * The domain layer speaks ISO-8601 in `Asia/Tehran`; only the presentation
 * layer converts, and never back. Formats follow the design system:
 * date `۱۴۰۵/۰۱/۱۵`, time `۱۴:۳۰`, date-time `۱۴۰۵/۰۱/۱۵، ۱۴:۳۰`, week
 * starting Saturday and Friday as the single holiday.
 */

/**
 * Product timezone. The charter fixes every instant to `Asia/Tehran`, so a
 * timestamp is converted to the Tehran wall clock *before* the Jalali maths —
 * `۲۰:۳۰` UTC is already the next day in Tehran, and picking the wrong day
 * here silently shifts every date the panel shows.
 */
const TEHRAN_TZ = 'Asia/Tehran';

/** Weekday names and numerals come from this locale (week starts Saturday). */
const PERSIAN_JALALI = 'fa';

/**
 * `YYYY-MM-DDTHH:mm:ss` in Tehran.
 *
 * `Intl` rather than a date library: `moment-jalaali` extends `moment/moment`,
 * which has no timezone support at all (`moment.tz` is `undefined`), so pulling
 * in `moment-timezone` would only be a way to reach functionality the platform
 * already provides. Resolving the wall clock here also makes the result
 * identical on a developer laptop and in the Docker container, whatever TZ
 * each happens to run in.
 */
function toTehranWallClock(value?: Date | string | number | null): string | null {
  const date = value === undefined || value === null ? new Date() : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    // `h23` keeps midnight at `00`; the default `h24` would render it `24`.
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

/**
 * `jYYYY` / `jMM` / `jDD` are the Jalali-aware tokens. The plain `YYYY` /
 * `MM` / `DD` tokens stay Gregorian even under the `fa` locale — they only
 * differ in that they emit Persian digits.
 */
const DATE_PATTERN = 'jYYYY/jMM/jDD';
const TIME_PATTERN = 'HH:mm';

function format(value: Date | string | number | null | undefined, pattern: string): string {
  const wallClock = toTehranWallClock(value);

  if (!wallClock) return '';

  return faDigits(moment(wallClock).locale(PERSIAN_JALALI).format(pattern));
}

/** `۱۴۰۵/۰۱/۱۵` — digits only, never grouped (a year is not `۱٬۴۰۵`). */
export function jalaliDate(value?: Date | string | number | null): string {
  return format(value, DATE_PATTERN);
}

/** `۱۴:۳۰`, 24-hour. */
export function jalaliTime(value?: Date | string | number | null): string {
  return format(value, TIME_PATTERN);
}

/** `۱۴۰۵/۰۱/۱۵، ۱۴:۳۰` — the design system's date-time form, comma included. */
export function jalaliDateTime(value?: Date | string | number | null): string {
  return `${jalaliDate(value)}، ${jalaliTime(value)}`;
}

/** `۱۴۰۵/۰۱/۱۵ — شنبه`, used where the weekday matters (the topbar). */
export function jalaliDateWithWeekday(value?: Date | string | number | null): string {
  return `${jalaliDate(value)} — ${jalaliWeekday(value)}`;
}

/** `سه‌شنبه ۵ آبان ۱۴۰۵` — weekday, bare day, Persian month name, year. */
export function jalaliDateWithWeekdayAndMonth(value?: Date | string | number | null): string {
  return format(value, 'dddd jD jMMMM jYYYY');
}

/** Weekday name only, e.g. `شنبه`. */
export function jalaliWeekday(value?: Date | string | number | null): string {
  return format(value, 'dddd');
}

/** Today, in the same `۱۴۰۵/۰۱/۱۵` shape as `jalaliDate`. */
export function jalaliToday(): string {
  return jalaliDate(new Date());
}
