import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';

class MonthPane extends StatelessWidget {
  const MonthPane({required this.current, required this.selected, required this.onShift, required this.onSelect, super.key});

  final DateTime current;
  final DateTime? selected;
  final ValueChanged<int> onShift;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final parts = toJalali(current);
    final gridStart = jalaliWeekStart(DateTime(current.year, current.month, 1));
    return Column(
      children: [
        CalendarNav(label: '${persianMonthName(parts.month)} ${toPersianDigits(parts.year)}', onShift: onShift),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              for (final name in persianDayNames) Expanded(child: Text(name, textAlign: TextAlign.center, style: BoyaTypography.overline)),
            ],
          ),
        ),
        for (var week = 0; week < 6; week++)
          Row(
            children: [
              for (var day = 0; day < 7; day++)
                Expanded(
                  child: DayCell(
                    date: gridStart.add(Duration(days: week * 7 + day)),
                    month: current.month,
                    selected: selected,
                    onSelect: onSelect,
                  ),
                ),
            ],
          ),
        Expanded(
          child: Center(
            child: selected == null
                ? Text('روزی را انتخاب کنید', style: BoyaTypography.body)
                : OutlinedButton(
                    // The calendar only knows the day; the bookings of that day
                    // are the list's job. Handing the day across keeps one
                    // query implementation instead of two that could disagree
                    // about what "this day" means.
                    onPressed: () => context.push(
                      bookingsCalendarListPath(selected!),
                    ),
                    child: Text(
                      'مشاهده رزروهای ${formatJalaliFull(selected!)}',
                      style: BoyaTypography.body,
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

class DayCell extends StatelessWidget {
  const DayCell({required this.date, required this.month, required this.selected, required this.onSelect, super.key});

  final DateTime date;
  final int month;
  final DateTime? selected;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final outside = date.month != month;
    final chosen = selected != null && DateUtils.isSameDay(selected!, date);
    return InkWell(
      onTap: outside ? null : () => onSelect(date),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Text(
          toPersianDigits('${date.day}'),
          textAlign: TextAlign.center,
          style: BoyaTypography.body.copyWith(
            color: outside ? BoyaColors.inkMuted : (isFriday(date) ? BoyaColors.error : BoyaColors.ink),
            fontWeight: chosen ? FontWeight.w700 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

class CalendarNav extends StatelessWidget {
  const CalendarNav({required this.label, required this.onShift, super.key});

  final String label;
  final ValueChanged<int> onShift;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: BoyaColors.primarySubtle,
      child: Row(
        children: [
          IconButton(onPressed: () => onShift(-1), icon: const Icon(Icons.chevron_right)),
          Expanded(child: Text(label, textAlign: TextAlign.center, style: BoyaTypography.body)),
          IconButton(onPressed: () => onShift(1), icon: const Icon(Icons.chevron_left)),
        ],
      ),
    );
  }
}
