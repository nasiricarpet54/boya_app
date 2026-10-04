import {
  dayKeyForCivilDate,
  formatClock,
  isOpenFor,
  parseDayWindow,
  slotStarts,
  windowFits,
  withinWindow,
} from './working-hours.util';

/** Iran is UTC+03:30 with no DST since 1401, so these offsets are exact. */
const at = (isoDateTime: string): Date => new Date(isoDateTime);

// 2026-09-26 is a Saturday, 2026-10-16 the Friday three weeks later.
const SATURDAY = '2026-09-26';
const FRIDAY = '2026-10-16';

const saturdaySalon = { sat: { active: true, start: '09:00', end: '20:00' } };

describe('parseDayWindow', () => {
  it('reads the window of an active day', () => {
    expect(parseDayWindow({ active: true, start: '09:00', end: '21:00' })).toEqual({
      open: 540,
      close: 1260,
    });
  });

  it('reads closed, malformed and zero-length days as no window', () => {
    expect(parseDayWindow(null)).toBeNull();
    expect(parseDayWindow({ active: false })).toBeNull();
    expect(parseDayWindow({ closed: true })).toBeNull();
    expect(parseDayWindow({ active: true, start: '09:00' })).toBeNull();
    expect(parseDayWindow({ active: true, start: '9:0', end: '21:00' })).toBeNull();
    expect(parseDayWindow({ active: true, start: '25:00', end: '26:00' })).toBeNull();
    expect(parseDayWindow({ active: true, start: '09:00', end: '09:00' })).toBeNull();
  });

  it('still reads rows written with the open/close shape', () => {
    expect(parseDayWindow({ open: '09:00', close: '21:00' })).toEqual({ open: 540, close: 1260 });
  });
});

describe('dayKeyForCivilDate', () => {
  it('maps a Gregorian date to its Jalali weekday key', () => {
    expect(dayKeyForCivilDate({ year: 2026, month: 9, day: 26 })).toBe('sat');
    expect(dayKeyForCivilDate({ year: 2026, month: 10, day: 15 })).toBe('thu');
    expect(dayKeyForCivilDate({ year: 2026, month: 10, day: 16 })).toBe('fri');
  });
});

describe('withinWindow', () => {
  it('is half-open: the opening minute is in, the closing minute is out', () => {
    const day = { open: 540, close: 1260 };

    expect(withinWindow(day, 540)).toBe(true);
    expect(withinWindow(day, 539)).toBe(false);
    expect(withinWindow(day, 1259)).toBe(true);
    expect(withinWindow(day, 1260)).toBe(false);
  });

  it('keeps an overnight window open in the small hours', () => {
    const overnight = { open: 1200, close: 120 };

    expect(withinWindow(overnight, 1320)).toBe(true); // 22:00
    expect(withinWindow(overnight, 60)).toBe(true); // 01:00 next morning
    expect(withinWindow(overnight, 180)).toBe(false); // 03:00
  });
});

describe('windowFits', () => {
  it('requires the service to finish by closing time', () => {
    const day = { open: 540, close: 1200 };

    expect(windowFits(day, 660, 60)).toBe(true); // 11:00–12:00
    expect(windowFits(day, 1140, 60)).toBe(true); // 19:00–20:00, ends on the dot
    expect(windowFits(day, 1140, 120)).toBe(false);
  });

  it('covers the small hours an overnight window spills into', () => {
    const overnight = { open: 1200, close: 120 };

    expect(windowFits(overnight, 1320, 60)).toBe(true); // 22:00–23:00
    expect(windowFits(overnight, 60, 60)).toBe(true); // 01:00–02:00
    expect(windowFits(overnight, 60, 120)).toBe(false); // would end at 03:00
  });

  it('reads a window from the day before with dayOffset 1', () => {
    const overnight = { open: 1200, close: 120 };

    expect(windowFits(overnight, 60, 60, 1)).toBe(true); // 01:00 the morning after
    expect(windowFits(overnight, 1320, 60, 1)).toBe(false); // 22:00 is not the morning after
  });
});

describe('slotStarts', () => {
  it('walks a window in half-hour steps', () => {
    const starts = slotStarts({ open: 540, close: 1200 }, 60);

    expect(starts).toHaveLength(21);
    expect(starts[0]).toBe(540); // 09:00
    expect(starts.at(-1)).toBe(1140); // 19:00, the last one that fits
  });

  it('has no slot for a service longer than the window', () => {
    expect(slotStarts({ open: 540, close: 600 }, 120)).toEqual([]);
  });

  it('keeps an overnight window inside the requested day', () => {
    expect(slotStarts({ open: 1200, close: 120 }, 60, 60)).toEqual([1200, 1260, 1320, 1380]);
  });
});

describe('isOpenFor', () => {
  it('reads the Tehran clock, not the host clock', () => {
    // 14:48 UTC is 18:18 in Tehran, 04:00 UTC is 07:30 — before opening.
    expect(isOpenFor(saturdaySalon, at(`${SATURDAY}T14:48:00Z`), 60)).toBe(true);
    expect(isOpenFor(saturdaySalon, at(`${SATURDAY}T04:00:00Z`), 60)).toBe(false);
  });

  it('closes a day the schedule has no entry for', () => {
    expect(isOpenFor(saturdaySalon, at(`${FRIDAY}T12:00:00+03:30`), 60)).toBe(false);
  });

  it('refuses a service that would run past closing time', () => {
    expect(isOpenFor(saturdaySalon, at(`${SATURDAY}T19:00:00+03:30`), 60)).toBe(true);
    expect(isOpenFor(saturdaySalon, at(`${SATURDAY}T19:30:00+03:30`), 60)).toBe(false);
  });

  it('judges the small hours against the window that opened them', () => {
    const overnight = { fri: { active: true, start: '20:00', end: '02:00' } };

    expect(isOpenFor(overnight, at(`${SATURDAY}T01:00:00+03:30`), 60)).toBe(true);
    expect(isOpenFor(overnight, at(`${SATURDAY}T03:00:00+03:30`), 60)).toBe(false);
  });

  it('treats a salon with no schedule at all as closed', () => {
    expect(isOpenFor({}, at(`${SATURDAY}T12:00:00+03:30`), 60)).toBe(false);
    expect(isOpenFor(null, at(`${SATURDAY}T12:00:00+03:30`), 60)).toBe(false);
  });
});

describe('formatClock', () => {
  it('pads to HH:MM and wraps past midnight', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(1470)).toBe('00:30');
  });
});
