import 'package:flutter_test/flutter_test.dart';

import 'package:boya_shared/utils/jalali_date_utils.dart';

void main() {
  test('converts Nowruz 1403', () {
    final date = toJalali(DateTime.utc(2024, 3, 20, 12));
    expect(date.year, 1403);
    expect(date.month, 1);
    expect(date.day, 1);
  });

  test('keeps 30 Esfand on leap year 1403', () {
    final date = toJalali(DateTime.utc(2025, 3, 20, 12));
    expect(date.year, 1403);
    expect(date.month, 12);
    expect(date.day, 30);
  });

  test('ends common year 1402 on 29 Esfand', () {
    final date = toJalali(DateTime.utc(2024, 3, 19, 12));
    expect(date.year, 1402);
    expect(date.month, 12);
    expect(date.day, 29);
  });

  test('formats Persian digits without forced zeros', () {
    expect(formatJalaliDate(DateTime.utc(2024, 3, 20, 12)), '۱۴۰۳/۱/۱');
  });

  test('uses the Tehran civil date across midnight UTC', () {
    final before = toJalali(DateTime.utc(2024, 3, 19, 20, 29));
    final after = toJalali(DateTime.utc(2024, 3, 19, 20, 30));
    expect(before.day, 29);
    expect(after.year, 1403);
    expect(after.month, 1);
    expect(after.day, 1);
  });

  test('treats Friday as weekend and Saturday as week start', () {
    final friday = DateTime.utc(2024, 3, 22, 12);
    final saturday = DateTime.utc(2024, 3, 23, 12);
    expect(isFriday(friday), isTrue);
    expect(jalaliWeekdayIndex(friday), 6);
    expect(isFriday(saturday), isFalse);
    expect(jalaliWeekdayIndex(saturday), 0);
  });

  test('names Friday and Saturday in Persian', () {
    expect(persianDayName(DateTime.utc(2024, 3, 22, 12)), 'جمعه');
    expect(persianDayName(DateTime.utc(2024, 3, 23, 12)), 'شنبه');
    expect(persianDayName(DateTime.utc(2024, 3, 24, 12)), 'یکشنبه');
  });

  test('jalaliWeekStart lands on the containing Saturday', () {
    // A Saturday maps to itself; a Friday maps to the Saturday 6 days back.
    final saturday = DateTime.utc(2026, 10, 3, 12);
    expect(isFriday(saturday), isFalse);
    expect(jalaliWeekStart(saturday), DateTime(2026, 10, 3));
    final friday = DateTime.utc(2026, 10, 2, 12);
    expect(isFriday(friday), isTrue);
    expect(jalaliWeekStart(friday), DateTime(2026, 9, 26));
  });
}
