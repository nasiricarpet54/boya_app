import { format, getDate, getMonth, getYear, isFriday as isJalaliFriday } from 'date-fns-jalali';

import { toPersianDigits } from './persian-number.util';

const TEHRAN_TIME_ZONE = 'Asia/Tehran';
const SATURDAY_WEEKDAY = 6;
const DAYS_IN_WEEK = 7;

/** Iran has kept a fixed UTC+3:30 offset since it dropped DST in 2022. */
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const MILLESECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLESECONDS_PER_WEEK = 7 * MILLESECONDS_PER_DAY;
const SEARCH_STEP_MS = 15 * 60 * 1000;
const MAX_SEARCH_STEPS = 12;

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

export interface TehranDateTimeParts extends JalaliDateParts {
  hour: number;
  minute: number;
}

/** Saturday is 0. Friday, the weekend, is 6. */
export function jalaliWeekdayIndex(date: Date): number {
  return (weekdayInTehran(date) - SATURDAY_WEEKDAY + DAYS_IN_WEEK) % DAYS_IN_WEEK;
}

export function isFriday(date: Date): boolean {
  return isJalaliFriday(tehranWallClock(date));
}

/** User-facing Jalali date, e.g. ۱۴۰۵/۱/۱۵. Stored instants stay UTC. */
export function formatJalaliDate(date: Date): string {
  const { year, month, day } = toJalali(date);
  return toPersianDigits(`${year}/${month}/${day}`);
}

/** User-facing 24-hour time in Tehran, e.g. ۱۴:۳۰. */
export function formatJalaliTime(date: Date): string {
  const { hour, minute } = tehranTime(date);
  return toPersianDigits(`${pad2(hour)}:${pad2(minute)}`);
}

/** User-facing Jalali date and time, e.g. ۱۴۰۵/۱/۱۵، ۱۴:۳۰. */
export function formatJalaliDateTime(date: Date): string {
  return `${formatJalaliDate(date)}، ${formatJalaliTime(date)}`;
}

/** Jalali civil date for the same instant in Asia/Tehran. Month is 1-12. */
export function toJalali(date: Date): JalaliDateParts {
  const wallClock = tehranWallClock(date);
  return {
    year: getYear(wallClock),
    month: getMonth(wallClock) + 1,
    day: getDate(wallClock),
  };
}

/** Latin Jalali date from date-fns-jalali, e.g. 1405/1/15. */
export function formatJalaliLatin(date: Date): string {
  return format(tehranWallClock(date), 'yyyy/M/d');
}

/**
 * UTC instant of the start of the Tehran civil day carrying `date`.
 *
 * Bookings store UTC instants in a `tstzrange`, so "today" for the salon
 * dashboard has to be cut on Tehran midnights rather than on the host's own
 * zone. The offset is a fixed guess that `tehranWallClock` re-checks, and a
 * small scan covers any offset the Intl rules would ever apply.
 */
export function startOfTehranDay(date: Date): Date {
  const wall = tehranWallClock(date);
  const guess = new Date(Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate()) - TEHRAN_OFFSET_MS);

  if (onTehranMidnight(guess) && sameCivilDay(tehranWallClock(guess), wall)) return guess;

  for (let step = 1; step <= MAX_SEARCH_STEPS; step++) {
    for (const delta of [step * SEARCH_STEP_MS, -step * SEARCH_STEP_MS]) {
      const candidate = new Date(guess.getTime() + delta);
      if (onTehranMidnight(candidate) && sameCivilDay(tehranWallClock(candidate), wall)) return candidate;
    }
  }

  return guess;
}

/** UTC instant of the Saturday that opens the Tehran week carrying `date`. */
export function startOfTehranWeek(date: Date): Date {
  const dayStart = startOfTehranDay(date);
  const daysIntoWeek = jalaliWeekdayIndex(date); // Saturday is 0, Friday is 6.
  return new Date(dayStart.getTime() - daysIntoWeek * MILLESECONDS_PER_DAY);
}

/** UTC instant that closes the week opened by `startOfTehranWeek`. */
export function endOfTehranWeek(date: Date): Date {
  return new Date(startOfTehranWeek(date).getTime() + MILLESECONDS_PER_WEEK);
}

function sameCivilDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Whether `instant` sits exactly on the Tehran midnight of its own day. */
function onTehranMidnight(instant: Date): boolean {
  const { hour, minute } = tehranTime(instant);
  return hour === 0 && minute === 0;
}

function tehranWallClock(date: Date): Date {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return new Date(
    part(formatted, 'year'),
    part(formatted, 'month') - 1,
    part(formatted, 'day'),
    part(formatted, 'hour'),
    part(formatted, 'minute'),
    part(formatted, 'second'),
  );
}

function tehranTime(date: Date): Pick<TehranDateTimeParts, 'hour' | 'minute'> {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return {
    hour: part(formatted, 'hour'),
    minute: part(formatted, 'minute'),
  };
}

function weekdayInTehran(date: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TIME_ZONE,
    weekday: 'short',
  }).format(date);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const index = weekdays.indexOf(formatted);
  if (index < 0) {
    throw new RangeError(`Unexpected weekday label: ${formatted}`);
  }
  return index;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((item) => item.type === type)?.value ?? '0';
  return Number(value);
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
