const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

final _latinDigit = RegExp(r'\d');
final _persianDigit = RegExp(r'[۰-۹]');
final _arabicIndicDigit = RegExp(r'[٠-٩]');

/// Converts Latin and Arabic-Indic digits to Persian numerals.
String toPersianDigits(Object value) {
  return value
      .toString()
      .replaceAllMapped(_latinDigit, (match) => persianDigits[int.parse(match.group(0)!)])
      .replaceAllMapped(
        _arabicIndicDigit,
        (match) => persianDigits[match.group(0)!.codeUnitAt(0) - 0x0660],
      );
}

/// Converts Persian and Arabic-Indic digits to Latin digits.
String toLatinDigits(String value) {
  return value
      .replaceAllMapped(_persianDigit, (match) => '${match.group(0)!.codeUnitAt(0) - 0x06f0}')
      .replaceAllMapped(
        _arabicIndicDigit,
        (match) => '${match.group(0)!.codeUnitAt(0) - 0x0660}',
      );
}
String formatPrice(num price) {
  final whole = price.round().abs().toString();
  final grouped = whole.replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (match) => '${match[1]}٬',
  );
  final sign = price < 0 ? '-' : '';
  return '$sign${toPersianDigits(grouped)} تومان';
}

String formatDurationMinutes(int minutes) {
  final hours = minutes ~/ 60;
  final remainder = minutes % 60;
  if (hours > 0 && remainder > 0) {
    return '${toPersianDigits(hours)} ساعت و ${toPersianDigits(remainder)} دقیقه';
  }
  if (hours > 0) return '${toPersianDigits(hours)} ساعت';
  return '${toPersianDigits(remainder)} دقیقه';
}

