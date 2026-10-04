import 'persian_number_utils.dart';

class JalaliDate {
  const JalaliDate({required this.year, required this.month, required this.day});

  final int year;
  final int month;
  final int day;

  /// Display form without forced leading zeros, e.g. ۱۴۰۵/۱/۱۵.
  String format() => toPersianDigits('$year/$month/$day');
}

/// Saturday is 0. Friday, the weekend, is 6.
///
/// Dart's [DateTime.weekday] is Monday=1 .. Sunday=7, so shifting by one lands
/// Saturday on 0 (Saturday=6 + 1 = 7 ≡ 0) and Friday on 6, matching
/// [persianDayNames].
int jalaliWeekdayIndex(DateTime date) {
  final tehran = _asTehran(date);
  return ((tehran.weekday + 1) % 7);
}

bool isFriday(DateTime date) => jalaliWeekdayIndex(date) == 6;

String formatJalaliDate(DateTime date) => toJalali(date).format();

String formatJalaliTime(DateTime date) {
  final tehran = _asTehran(date);
  final hour = tehran.hour.toString().padLeft(2, '0');
  final minute = tehran.minute.toString().padLeft(2, '0');
  return toPersianDigits('$hour:$minute');
}

String formatJalaliDateTime(DateTime date) {
  return '${formatJalaliDate(date)}، ${formatJalaliTime(date)}';
}

/// Converts an absolute instant to the Jalali civil date in Asia/Tehran.
JalaliDate toJalali(DateTime date) {
  final tehran = _asTehran(date);
  // `1948320` is the JDN of 1 Farvardin 1 AP, so `days` counts whole days
  // since the Jalali epoch. (Using 1948321 shifts every date one day back —
  // Nowruz landed on 29 Esfand instead of 1 Farvardin.)
  var julian = _gregorianToJulianDay(tehran.year, tehran.month, tehran.day);
  var days = julian - 1948320;
  var year = 1;
  while (days >= _jalaliYearLength(year)) {
    days -= _jalaliYearLength(year);
    year += 1;
  }
  final month = days < 186 ? days ~/ 31 + 1 : (days - 186) ~/ 30 + 7;
  final day = days - (month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30) + 1;
  return JalaliDate(year: year, month: month, day: day);
}

DateTime _asTehran(DateTime date) {
  final utc = date.toUtc();
  return utc.add(const Duration(hours: 3, minutes: 30));
}

int _gregorianToJulianDay(int year, int month, int day) {
  final adjustedYear = month <= 2 ? year - 1 : year;
  final adjustedMonth = month <= 2 ? month + 12 : month;
  final century = adjustedYear ~/ 100;
  final shift = 2 - century + century ~/ 4;
  return (365.25 * (adjustedYear + 4716)).floor() +
      (30.6001 * (adjustedMonth + 1)).floor() +
      day +
      shift -
      1524;
}

int _jalaliYearLength(int year) => _isJalaliLeapYear(year) ? 366 : 365;

bool _isJalaliLeapYear(int year) {
  final cycle = year > 0 ? ((year - 1) % 33) + 1 : year;
  return const [1, 5, 9, 13, 17, 22, 26, 30].contains(cycle);
}
const persianDayNames = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

const persianMonthNames = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

String persianDayName(DateTime date) => persianDayNames[jalaliWeekdayIndex(date)];

String persianMonthName(int month) {
  if (month < 1 || month > 12) {
    throw RangeError.value(month, 'month', 'Jalali month must be 1 to 12');
  }
  return persianMonthNames[month - 1];
}

/// ۱۵ فروردین ۱۴۰۵
String formatJalaliLong(DateTime date) {
  final parts = toJalali(date);
  return '${toPersianDigits(parts.day)} ${persianMonthName(parts.month)} ${toPersianDigits(parts.year)}';
}

/// شنبه ۱۵ فروردین ۱۴۰۵
String formatJalaliFull(DateTime date) {
  return '${persianDayName(date)} ${formatJalaliLong(date)}';
}

/// Saturday 00:00 of the civil week that contains [date].
DateTime jalaliWeekStart(DateTime date) {
  final tehran = _asTehran(date);
  final start = DateTime(tehran.year, tehran.month, tehran.day)
      .subtract(Duration(days: jalaliWeekdayIndex(date)));
  return start;
}

int currentJalaliYear([DateTime? now]) => toJalali(now ?? DateTime.now()).year;

List<String> jalaliWeekdayHeaders() => persianDayNames;

