import { isSalonOpenNow } from './salon.service';

/** Iran is UTC+03:30 with no DST since 1401, so these offsets are exact. */
const tehran = (isoDateTime: string): Date => new Date(isoDateTime);

// 2026-09-26 is a Saturday, 2026-09-25 the Friday before it.
const SATURDAY = '2026-09-26';
const FRIDAY = '2026-09-25';

describe('isSalonOpenNow', () => {
  it('reports an open salon at 18:18 on Saturday', () => {
    const hours = { sat: { active: true, start: '09:00', end: '21:00' } };

    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T18:18:00+03:30`))).toBe(true);
  });

  it('reports a closed salon on a day flagged inactive', () => {
    const hours = { fri: { active: false } };

    expect(isSalonOpenNow(hours, tehran(`${FRIDAY}T18:18:00+03:30`))).toBe(false);
  });

  it('keeps a window that runs past midnight open at 22:00', () => {
    const hours = { sat: { active: true, start: '20:00', end: '02:00' } };

    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T22:00:00+03:30`))).toBe(true);
  });

  it('closes the overnight window at 03:00', () => {
    const hours = { sat: { active: true, start: '20:00', end: '02:00' } };

    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T03:00:00+03:30`))).toBe(false);
  });

  it('treats the window as half-open: start included, end excluded', () => {
    const hours = { sat: { active: true, start: '09:00', end: '21:00' } };

    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T09:00:00+03:30`))).toBe(true);
    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T08:59:00+03:30`))).toBe(false);
    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T21:00:00+03:30`))).toBe(false);
  });

  it('uses the Tehran clock even when the host is on UTC', () => {
    const hours = { sat: { active: true, start: '09:00', end: '21:00' } };

    // 14:48 UTC is 18:18 in Tehran. On a UTC host the local hour would be 14:48,
    // which is still inside the window, so use a window that only the Tehran
    // reading can satisfy: 18:00-19:00 Tehran is 14:30-15:00 UTC.
    const narrow = { sat: { active: true, start: '18:00', end: '19:00' } };

    expect(isSalonOpenNow(hours, new Date('2026-09-26T14:48:00Z'))).toBe(true);
    expect(isSalonOpenNow(narrow, new Date('2026-09-26T14:48:00Z'))).toBe(true);
    expect(isSalonOpenNow(narrow, new Date('2026-09-26T14:00:00Z'))).toBe(false);
  });

  it('picks the Friday schedule on a Friday evening', () => {
    const hours = {
      sat: { active: true, start: '09:00', end: '21:00' },
      fri: { active: true, start: '12:00', end: '23:00' },
    };

    expect(isSalonOpenNow(hours, tehran(`${FRIDAY}T18:18:00+03:30`))).toBe(true);
    expect(isSalonOpenNow(hours, tehran(`${FRIDAY}T11:00:00+03:30`))).toBe(false);
  });

  it('closes on missing, malformed or empty schedules', () => {
    const saturdayNoon = tehran(`${SATURDAY}T12:00:00+03:30`);

    expect(isSalonOpenNow(null, saturdayNoon)).toBe(false);
    expect(isSalonOpenNow({}, saturdayNoon)).toBe(false);
    expect(isSalonOpenNow({ sat: null }, saturdayNoon)).toBe(false);
    expect(isSalonOpenNow({ sat: { active: true, start: '09:00' } }, saturdayNoon)).toBe(false);
    expect(isSalonOpenNow({ sat: { active: true, end: '21:00' } }, saturdayNoon)).toBe(false);
    expect(
      isSalonOpenNow({ sat: { active: true, start: '9:0', end: '21:00' } }, saturdayNoon),
    ).toBe(false);
    expect(
      isSalonOpenNow({ sat: { active: true, start: '25:00', end: '26:00' } }, saturdayNoon),
    ).toBe(false);
  });

  it('does not read a zero-length window as all day', () => {
    const hours = { sat: { active: true, start: '09:00', end: '09:00' } };

    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T12:00:00+03:30`))).toBe(false);
    expect(isSalonOpenNow(hours, tehran(`${SATURDAY}T09:00:00+03:30`))).toBe(false);
  });

  it('still reads rows written with the open/close shape', () => {
    const legacy = { sat: { open: '09:00', close: '21:00' }, fri: { closed: true } };

    expect(isSalonOpenNow(legacy, tehran(`${SATURDAY}T18:18:00+03:30`))).toBe(true);
    expect(isSalonOpenNow(legacy, tehran(`${FRIDAY}T18:18:00+03:30`))).toBe(false);
  });
});
