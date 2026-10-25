import 'package:flutter/material.dart';

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
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: start,
      lastDate: end,
      helpText: 'انتخاب تاریخ',
      cancelText: 'انصراف',
      confirmText: 'تأیید',
    );
    if (picked != null) onDateSelected(picked);
  }
}

DateTime _clamp(DateTime value, DateTime start, DateTime end) {
  if (value.isBefore(start)) return start;
  if (value.isAfter(end)) return end;
  return value;
}
