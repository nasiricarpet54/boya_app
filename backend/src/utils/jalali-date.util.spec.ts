import { formatJalaliDate, isFriday, jalaliWeekdayIndex, toJalali } from './jalali-date.util';

describe('Jalali dates', () => {
  it('converts Nowruz 1403 to the Gregorian civil date', () => {
    expect(toJalali(new Date(Date.UTC(2024, 2, 20, 12)))).toEqual({
      year: 1403,
      month: 1,
      day: 1,
    });
  });

  it('keeps 30 Esfand on the leap year 1403', () => {
    expect(toJalali(new Date(Date.UTC(2025, 2, 20, 12)))).toEqual({
      year: 1403,
      month: 12,
      day: 30,
    });
  });

  it('rolls a common year from 29 Esfand to 1 Farvardin', () => {
    expect(toJalali(new Date(Date.UTC(2024, 2, 19, 12)))).toEqual({
      year: 1402,
      month: 12,
      day: 29,
    });
    expect(toJalali(new Date(Date.UTC(2024, 2, 20, 12)))).toEqual({
      year: 1403,
      month: 1,
      day: 1,
    });
  });

  it('formats the display date with Persian digits and no forced zeros', () => {
    expect(formatJalaliDate(new Date(Date.UTC(2024, 2, 20, 12)))).toBe('۱۴۰۳/۱/۱');
  });

  it('uses the Tehran civil date across the UTC midnight boundary', () => {
    expect(toJalali(new Date(Date.UTC(2024, 2, 19, 20, 29)))).toEqual({
      year: 1402,
      month: 12,
      day: 29,
    });
    expect(toJalali(new Date(Date.UTC(2024, 2, 19, 20, 30)))).toEqual({
      year: 1403,
      month: 1,
      day: 1,
    });
  });

  it('treats Friday as the weekend and Saturday as the week start', () => {
    const friday = new Date(Date.UTC(2024, 2, 22, 12));
    const saturday = new Date(Date.UTC(2024, 2, 23, 12));

    expect(isFriday(friday)).toBe(true);
    expect(jalaliWeekdayIndex(friday)).toBe(6);
    expect(isFriday(saturday)).toBe(false);
    expect(jalaliWeekdayIndex(saturday)).toBe(0);
  });
});
