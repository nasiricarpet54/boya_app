import { Injectable } from '@nestjs/common';
import { getDate, getMonth, getYear, parse } from 'date-fns-jalali';

import { formatJalaliTime, isFriday, jalaliWeekdayIndex, toJalali } from '../../utils/jalali-date.util';
import { toLatinDigits, toPersianDigits } from '../../utils/persian-number.util';

const PERSIAN_DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const;
const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const;
const JALALI_DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

/**
 * UTC midnight of the Gregorian day a Jalali date opens.
 *
 * `newDate` from date-fns-jalali builds a *local* midnight, so its instant
 * shifts with the host timezone (UTC+3:30 in Tehran). The Jalali calendar is
 * a civil calendar here, so the day boundary is pinned to UTC instead and the
 * result is the same on CI, on a developer laptop and in production.
 */
function jalaliDayToUtcMidnight(year: number, month: number, day: number): Date {
  const parsed = parse(`${year}/${month}/${day}`, 'yyyy/M/d', new Date(2000, 0, 1));
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

/**
 * Display conversion only. Appointments stay UTC instants; nothing here is stored.
 * Friday is the known weekend. Official holidays need a calendar source and are not guessed.
 */
@Injectable()
export class JalaliDateService {
  /** Persian digits, no forced zeros, e.g. ۱۴۰۳/۱/۱. */
  toJalali(gregorianDate: Date): string {
    const parts = toJalali(gregorianDate);
    return toPersianDigits(`${parts.year}/${parts.month}/${parts.day}`);
  }

  /** Parses ۱۴۰۳/۰۱/۰۱ as the UTC instant of the Gregorian day it opens. */
  toGregorian(jalaliDate: string): Date {
    const normalized = toLatinDigits(jalaliDate).trim();
    const match = JALALI_DATE.exec(normalized);
    if (!match) throw new RangeError('Invalid Jalali date');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = parse(normalized, 'yyyy/M/d', new Date(2000, 0, 1));
    if (Number.isNaN(parsed.getTime()) || getYear(parsed) !== year || getMonth(parsed) !== month - 1 || getDate(parsed) !== day) {
      throw new RangeError('Invalid Jalali date');
    }
    return jalaliDayToUtcMidnight(year, month, day);
  }

  /** شنبه through جمعه. Saturday is the week start. */
  getPersianDayName(date: Date): string {
    return PERSIAN_DAY_NAMES[jalaliWeekdayIndex(date)];
  }

  isFriday(date: Date): boolean {
    return isFriday(date);
  }

  /** Saturday 00:00 UTC of the Jalali week carrying `date`. */
  getWeekStart(date: Date): Date {
    const parts = toJalali(date);
    const midnight = jalaliDayToUtcMidnight(parts.year, parts.month, parts.day);
    midnight.setUTCDate(midnight.getUTCDate() - jalaliWeekdayIndex(date));
    return midnight;
  }

  /** e.g. چهارشنبه ۱ فروردین ۱۴۰۳. */
  formatPersianDate(date: Date): string {
    const parts = toJalali(date);
    return `${this.getPersianDayName(date)} ${toPersianDigits(parts.day)} ${this.getPersianMonthName(parts.month)} ${toPersianDigits(parts.year)}`;
  }

  getPersianMonthName(month: number): string {
    const name = PERSIAN_MONTH_NAMES[month - 1];
    if (!name) throw new RangeError('Invalid Jalali month');
    return name;
  }

  toPersianNumerals(input: string | number): string {
    return toPersianDigits(input);
  }

  normalizePersianNumerals(input: string): string {
    return toLatinDigits(input);
  }

  getCurrentJalali(now: Date = new Date()): string {
    return this.toJalali(now);
  }

  getCurrentJalaliTime(now: Date = new Date()): string {
    return formatJalaliTime(now);
  }

  /** Friday only. Pass other holidays in; this does not invent an official calendar. */
  isHoliday(date: Date, extraHolidays: ReadonlySet<string> = new Set()): boolean {
    return this.isFriday(date) || extraHolidays.has(this.toJalali(date));
  }
}
