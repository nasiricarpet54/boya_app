import { formatJalaliTime, jalaliWeekdayIndex } from './jalali-date.util';
import { toLatinDigits } from './persian-number.util';

/**
 * Reads `tenants.working_hours` and turns a Tehran calendar day into bookable
 * times.
 *
 * The column is JSONB keyed `sat`…`fri` in Jalali order (Saturday opens the
 * week, Friday is the weekend), each entry shaped
 * `{ start: "09:00", end: "21:00", active: true }`. Rows written by the first
 * seeds use `{ open, close, closed }` instead and are still accepted. An entry
 * whose `end` is not after its `start` runs past midnight (`20:00`–`02:00`).
 *
 * Times are carried as minutes since Tehran midnight rather than through
 * `Date#setHours`/`Date#getDay`, which read the *host* clock: on a UTC
 * container every slot would silently shift by 3h30, while the charter pins
 * business hours to Asia/Tehran. Instants are produced by PostgreSQL
 * (`AT TIME ZONE 'Asia/Tehran'`), which owns the timezone rules.
 */

/** Jalali order: Saturday is 0, Friday — the weekend — is 6. */
export const WEEK_DAY_KEYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
export type WeekDayKey = (typeof WEEK_DAY_KEYS)[number];

export const MINUTES_PER_DAY = 24 * 60;

/** Slots are generated every half hour, as in `AvailabilityService`. */
export const DEFAULT_SLOT_STEP_MINUTES = 30;

/** One day of the weekly schedule as stored in tenants.working_hours. */
export interface DaySchedule {
  start?: unknown;
  end?: unknown;
  active?: unknown;
  /** Shape written by the first version of the seeds; still in older rows. */
  open?: unknown;
  close?: unknown;
  closed?: unknown;
}

/** Opening and closing time of one day, in minutes since local midnight. */
export interface DayWindow {
  open: number;
  close: number;
}

/** A calendar day, as parsed from a `YYYY-MM-DD` input. */
export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export function parseTimeOfDay(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

/**
 * Open window of one schedule entry, or null when the day is closed:
 * `active: false`, the legacy `closed: true`, a missing/malformed time, or a
 * zero-length window (which would otherwise read as always open).
 */
export function parseDayWindow(entry: unknown): DayWindow | null {
  if (entry === null || entry === undefined || typeof entry !== 'object') return null;
  const day = entry as DaySchedule;
  if (day.active === false || day.closed === true) return null;

  const open = parseTimeOfDay(day.start ?? day.open);
  const close = parseTimeOfDay(day.end ?? day.close);
  if (open === null || close === null || open === close) return null;
  return { open, close };
}

/** Open window of a weekday in a salon's schedule; null when it is closed. */
export function dayWindow(workingHours: unknown, key: WeekDayKey): DayWindow | null {
  if (workingHours === null || workingHours === undefined || typeof workingHours !== 'object') {
    return null;
  }
  return parseDayWindow((workingHours as Record<string, unknown>)[key]);
}

/** Tehran weekday key of the day carrying this instant. */
export function dayKeyForInstant(instant: Date): WeekDayKey {
  return WEEK_DAY_KEYS[jalaliWeekdayIndex(instant)];
}

/**
 * Tehran weekday key of a calendar day, independent of the host clock. The
 * probe sits at noon UTC, which is 15:30 in Tehran, so the Jalali conversion
 * can never land on a neighbouring day.
 */
export function dayKeyForCivilDate(date: CivilDate): WeekDayKey {
  const noonUtc = new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
  return WEEK_DAY_KEYS[jalaliWeekdayIndex(noonUtc)];
}

/** Minutes since Tehran midnight, so 18:18 becomes 1098. */
export function minutesSinceMidnight(instant: Date): number {
  // formatJalaliTime already resolves Asia/Tehran and pads to HH:MM; the digits
  // come back Persian, hence the conversion back to Latin.
  const [hours, minutes] = formatJalaliTime(instant).split(':').map(toLatinDigits);
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Is `minute` inside the window? Half-open: the opening minute counts as open,
 * the closing minute as closed.
 */
export function withinWindow(window: DayWindow, minute: number): boolean {
  // end <= start means the window continues into the next morning.
  return window.close > window.open
    ? minute >= window.open && minute < window.close
    : minute >= window.open || minute < window.close;
}

/**
 * Does a service of `durationMinutes` starting at `startMinute` fit the window?
 *
 * `dayOffset` shifts the start by whole days, which is how the morning after a
 * window that ran past midnight is judged: the previous day's schedule is
 * consulted with `dayOffset` 1.
 *
 * A same-day window (`09:00`–`20:00`) is [open, close]. A window that wraps
 * (`20:00`–`02:00`) covers the evening it opens on *and* the small hours that
 * follow it — the same reading `withinWindow` uses for "is the salon open now".
 */
export function windowFits(
  window: DayWindow,
  startMinute: number,
  durationMinutes: number,
  dayOffset = 0,
): boolean {
  const start = startMinute + dayOffset * MINUTES_PER_DAY;
  const end = start + durationMinutes;

  if (window.close > window.open) {
    return start >= window.open && end <= window.close;
  }

  const evening = start >= window.open && end <= window.close + MINUTES_PER_DAY;
  const smallHours = dayOffset === 0 && start < window.close && end <= window.close;
  return evening || smallHours;
}

/**
 * Start minutes of every slot of `window` that has room for the service.
 *
 * Slots stay inside the requested calendar day: the small hours an overnight
 * window spills into answer to the *previous* day's request. The step and the
 * "a slot may end exactly on closing time" rule mirror
 * `AvailabilityService.generateSlots`.
 */
export function slotStarts(
  window: DayWindow,
  durationMinutes: number,
  stepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): number[] {
  if (durationMinutes <= 0 || stepMinutes <= 0) return [];

  const closes = window.close > window.open ? window.close : window.close + MINUTES_PER_DAY;
  const starts: number[] = [];
  for (let start = window.open; start + durationMinutes <= closes; start += stepMinutes) {
    if (start >= MINUTES_PER_DAY) break;
    starts.push(start);
  }
  return starts;
}

/**
 * Would the salon still be serving `durationMinutes` when `instant` arrives?
 *
 * A day with no entry in the schedule is closed, and so is a salon that
 * configured nothing at all. The previous day is consulted too, so a service
 * running past midnight — or an early-morning start after an overnight window —
 * is judged against the schedule that actually opened the window.
 */
export function isOpenFor(
  workingHours: unknown,
  instant: Date,
  durationMinutes: number,
): boolean {
  const minute = minutesSinceMidnight(instant);

  const today = dayWindow(workingHours, dayKeyForInstant(instant));
  if (today && windowFits(today, minute, durationMinutes)) return true;

  const yesterdayInstant = new Date(instant.getTime() - MINUTES_PER_DAY * 60_000);
  const yesterday = dayWindow(workingHours, dayKeyForInstant(yesterdayInstant));
  return yesterday !== null && windowFits(yesterday, minute, durationMinutes, 1);
}

/** `HH:MM` label for a minute count, wrapping past midnight (1470 → 00:30). */
export function formatClock(minute: number): string {
  const wrapped = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

