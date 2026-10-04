import 'package:flutter/material.dart';
import 'package:parsi_datetime_picker/parsi_datetime_picker.dart';

import '../theme/boya_colors.dart';
import '../theme/boya_typography.dart';
import '../utils/jalali_date_utils.dart';

/// Jalali date field. Friday is marked as the weekend but stays selectable.
class BoyaDatePicker extends StatelessWidget {
  const BoyaDatePicker({
    required this.onDateSelected,
    super.key,
    this.initialDate,
    this.firstDate,
    this.lastDate,
  });

  final DateTime? initialDate;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final ValueChanged<DateTime> onDateSelected;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      icon: const Icon(Icons.calendar_month, color: BoyaColors.primary),
      label: Text(
        initialDate != null ? formatJalaliDate(initialDate!) : 'انتخاب تاریخ',
        style: BoyaTypography.body.copyWith(fontWeight: FontWeight.w600),
      ),
      onPressed: () => _showPicker(context),
    );
  }

  Future<void> _showPicker(BuildContext context) async {
    final start = firstDate ?? DateTime(1921, 3, 21);
    final end = lastDate ?? DateTime(2091, 3, 20);
    final initial = _clamp(initialDate ?? DateTime.now(), start, end);
    final picked = await showParsiDatePicker(
      context: context,
      initialDate: ParsiDate.fromDateTime(initial),
      firstDate: ParsiDate.fromDateTime(start),
      lastDate: ParsiDate.fromDateTime(end),
      helpText: 'انتخاب تاریخ',
      cancelText: 'انصراف',
      confirmText: 'تأیید',
      holidayDates: _fridays(start, end),
    );
    if (picked != null) onDateSelected(picked.toDateTime());
  }
}

DateTime _clamp(DateTime value, DateTime start, DateTime end) {
  if (value.isBefore(start)) return start;
  if (value.isAfter(end)) return end;
  return value;
}

List<ParsiDate> _fridays(DateTime start, DateTime end) {
  final dates = <ParsiDate>[];
  var cursor = DateTime(start.year, start.month, start.day);
  final limit = DateTime(end.year, end.month, end.day);
  while (cursor.weekday != DateTime.friday) {
    cursor = cursor.add(const Duration(days: 1));
  }
  while (!cursor.isAfter(limit) && dates.length < 3660) {
    dates.add(ParsiDate.fromDateTime(cursor));
    cursor = cursor.add(const Duration(days: 7));
  }
  return dates;
}
