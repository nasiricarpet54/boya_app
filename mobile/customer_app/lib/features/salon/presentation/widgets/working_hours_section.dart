import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// Weekly schedule shown on the salon detail page.
///
/// The column is a JSONB object keyed `sat`…`fri` in Jalali order (Saturday
/// opens the week, Friday is the weekend). Each entry can be either shape the
/// backend accepted over time:
///
/// - `{ open: "09:00", close: "20:00" }` — the first seeds.
/// - `{ start: "09:00", end: "21:00", active: true }` — the current panel.
///
/// A day is closed when `closed: true` or `active: false`, or when it has no
/// readable time. Today's row is highlighted so the customer sees "am I open
/// right now?" at a glance.
class WorkingHoursSection extends StatelessWidget {
  const WorkingHoursSection({required this.workingHours, super.key});

  /// Raw `tenants.working_hours` map as parsed from the detail endpoint.
  final Map<String, dynamic> workingHours;

  @override
  Widget build(BuildContext context) {
    // Jalali keys in display order; Saturday is 0, Friday (weekend) is 6.
    const keys = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
    final todayIndex = jalaliWeekdayIndex(DateTime.now());

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ساعات کاری', style: BoyaTypography.title),
          const SizedBox(height: 12),
          for (var index = 0; index < keys.length; index++)
            _HourRow(
              name: persianDayNames[index],
              schedule: _entry(workingHours[keys[index]]),
              isToday: index == todayIndex,
            ),
        ],
      ),
    );
  }

  /// Normalizes both accepted shapes into the display parts.
  _DaySchedule _entry(dynamic raw) {
    if (raw is! Map) return const _DaySchedule.closed();
    final closed = raw['closed'] == true || raw['active'] == false;
    if (closed) return const _DaySchedule.closed();

    final open = _time(raw['open'] ?? raw['start']);
    final close = _time(raw['close'] ?? raw['end']);
    if (open == null || close == null) return const _DaySchedule.notSet();
    return _DaySchedule(open: open, close: close, isSet: true);
  }

  /// Accepts "09:00" and renders it in Persian digits.
  String? _time(dynamic value) {
    if (value is! String) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : toPersianDigits(trimmed);
  }
}

/// Display parts of one day, flattened from either backend shape.
class _DaySchedule {
  const _DaySchedule({this.open, this.close, this.isSet = false})
      : closed = false;

  const _DaySchedule.closed()
      : open = null,
        close = null,
        isSet = false,
        closed = true;

  const _DaySchedule.notSet()
      : open = null,
        close = null,
        isSet = false,
        closed = false;

  final String? open;
  final String? close;
  final bool isSet;

  /// True for `closed: true` or `active: false`.
  final bool closed;
}

class _HourRow extends StatelessWidget {
  const _HourRow({
    required this.name,
    required this.schedule,
    required this.isToday,
  });

  final String name;
  final _DaySchedule schedule;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final String label;
    final Color color;
    if (schedule.closed) {
      label = 'تعطیل';
      color = BoyaColors.error;
    } else if (schedule.isSet) {
      label = '${schedule.open} تا ${schedule.close}';
      color = BoyaColors.ink;
    } else {
      label = 'ثبت نشده';
      color = BoyaColors.inkMuted;
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 3),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isToday
            ? BoyaColors.primary.withValues(alpha: 0.08)
            : BoyaColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isToday ? BoyaColors.primary : BoyaColors.line,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              name,
              style: BoyaTypography.body.copyWith(
                color: BoyaColors.ink,
                fontWeight: isToday ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ),
          Text(
            label,
            style: BoyaTypography.caption.copyWith(
              color: color,
              fontWeight: isToday ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }
}
