import { JalaliDateService } from './jalali-date.service';

describe('JalaliDateService', () => {
  const service = new JalaliDateService();
  const nowruz = new Date(Date.UTC(2024, 2, 20, 12));

  it('shows Nowruz 1403 with Persian digits', () => {
    expect(service.toJalali(nowruz)).toBe('۱۴۰۳/۱/۱');
  });

  it('turns a Persian Jalali date back into Tehran midnight', () => {
    expect(service.toGregorian('۱۴۰۳/۰۱/۰۱').toISOString()).toBe('2024-03-19T20:30:00.000Z');
  });

  it('rejects 30 Esfand of a common year', () => {
    expect(() => service.toGregorian('1402/12/30')).toThrow('Invalid Jalali date');
  });

  it('names Saturday the week start and Friday the weekend', () => {
    const friday = new Date(Date.UTC(2024, 2, 22, 12));
    const saturday = new Date(Date.UTC(2024, 2, 23, 12));

    expect(service.getPersianDayName(nowruz)).toBe('چهارشنبه');
    expect(service.getPersianDayName(friday)).toBe('جمعه');
    expect(service.isFriday(friday)).toBe(true);
    expect(service.isHoliday(friday)).toBe(true);
    expect(service.isHoliday(saturday)).toBe(false);
    expect(service.getWeekStart(friday).toISOString()).toBe('2024-03-15T20:30:00.000Z');
  });

  it('formats the spoken Persian date', () => {
    expect(service.formatPersianDate(nowruz)).toBe('چهارشنبه ۱ فروردین ۱۴۰۳');
  });
});
