import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../salon/data/salon_api.dart';

/// Jalali week strip for the booking form (شنبه تا جمعه).
///
/// Two things were wrong here: the strip had no way to leave the week it was
/// born in, and the labelled date under it opened nothing. Navigation now
/// moves a whole week at a time inside the bookable window (today .. today +
/// 90 days), and the calendar button opens `showParsiDatePicker` (or a month
/// grid when the package fails), after which the strip jumps to the picked
/// date's week.
class JalaliDatePickerCard extends ConsumerStatefulWidget {
  const JalaliDatePickerCard({
    required this.selectedDate,
    required this.onDateSelected,
    required this.salonId,
    required this.serviceId,
    this.specialistId,
    super.key,
  });

  final DateTime selectedDate;
  final ValueChanged<DateTime> onDateSelected;
  final String salonId;
  final String serviceId;
  final String? specialistId;

  @override
  ConsumerState<JalaliDatePickerCard> createState() => _JalaliDatePickerCardState();
}

class _JalaliDatePickerCardState extends ConsumerState<JalaliDatePickerCard> {
  /// Saturday of the week the strip shows. Kept apart from the picked day so
  /// the arrows can browse without changing the selection.
  late DateTime _weekStart;

  /// Key for the explicit-height wrapper around the calendar button, used
  /// only to verify the hit-test size after layout.
  final GlobalKey _dateButtonBoxKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _weekStart = jalaliWeekStart(widget.selectedDate);
  }

  @override
  void didUpdateWidget(covariant JalaliDatePickerCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A pick made in the calendar drags the strip to that date's week.
    if (!_sameDay(widget.selectedDate, oldWidget.selectedDate)) {
      _weekStart = jalaliWeekStart(widget.selectedDate);
    }
  }

  /// Booking starts today, never before, and stops 90 days out.
  DateTime get _firstDate {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  DateTime get _lastDate => _firstDate.add(const Duration(days: 90));

  bool get _canGoPrevious => _weekStart.isAfter(jalaliWeekStart(_firstDate));

  bool get _canGoNext => !_weekStart.add(const Duration(days: 7)).isAfter(_lastDate);

  void _goPreviousWeek() {
    if (!_canGoPrevious) return;
    setState(() => _weekStart = _weekStart.subtract(const Duration(days: 7)));
  }

  void _goNextWeek() {
    if (!_canGoNext) return;
    setState(() => _weekStart = _weekStart.add(const Duration(days: 7)));
  }

  /// Whether the strip should offer [date]: today .. today+90, never a Friday.
  bool _isBookable(DateTime date) {
    final day = DateTime(date.year, date.month, date.day);
    if (isFriday(day)) return false;
    if (day.isBefore(_firstDate)) return false;
    return !day.isAfter(_lastDate);
  }

  /// Opens the month calendar. `showParsiDatePicker` is the primary path; a
  /// plain month grid dialog takes over if the package cannot render.
  Future<void> _openCalendar() async {
    final start = _firstDate;
    final end = _lastDate;
    final initial = _clamp(widget.selectedDate, start, end);
    DateTime? picked;
    debugPrint('date-button tapped → opening calendar (initial: $initial)');
    try {
      final result = await showParsiDatePicker(
        context: context,
        initialDate: ParsiDate.fromDateTime(initial),
        firstDate: ParsiDate.fromDateTime(start),
        lastDate: ParsiDate.fromDateTime(end),
        helpText: 'انتخاب تاریخ',
        cancelText: 'انصراف',
        confirmText: 'تأیید',
        holidayDates: _fridays(start, end),
      );
      picked = result?.toDateTime();
      debugPrint('showParsiDatePicker → picked: $picked');
    } catch (error, stackTrace) {
      // The package could not show its dialog: print the failure so it is
      // visible in the console, then hand the customer a month grid instead
      // of leaving the button dead.
      debugPrint('Calendar error: $error');
      debugPrint('$stackTrace');
      if (!mounted) return;
      picked = await showDialog<DateTime>(
        context: context,
        builder: (_) => _MonthPickerDialog(initial: initial, start: start, end: end),
      );
      debugPrint('_MonthPickerDialog → picked: $picked');
    }
    if (picked == null || !mounted) return;
    final day = DateTime(picked.year, picked.month, picked.day);
    if (!_isBookable(day)) return;
    widget.onDateSelected(day);
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final box = _dateButtonBoxKey.currentContext?.findRenderObject() as RenderBox?;
      debugPrint('date-button size: ${box?.size}');
    });
    final selectedDay = DateTime(
      widget.selectedDate.year,
      widget.selectedDate.month,
      widget.selectedDate.day,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              onPressed: _canGoPrevious ? _goPreviousWeek : null,
              tooltip: 'هفته قبل',
              icon: const Icon(Icons.chevron_right),
            ),
            Expanded(
              child: Column(
                children: [
                  Text(
                    '${formatJalaliDate(_weekStart)} تا ${formatJalaliDate(_weekStart.add(const Duration(days: 6)))}',
                    style: BoyaTypography.caption,
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    'هفته ${toPersianDigits(_weekNumber)}',
                    style: BoyaTypography.overline,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: _canGoNext ? _goNextWeek : null,
              tooltip: 'هفته بعد',
              icon: const Icon(Icons.chevron_left),
            ),
          ],
        ),
        Row(
          children: [
            for (var index = 0; index < 7; index++)
              Expanded(
                child: _DayCell(
                  date: _weekStart.add(Duration(days: index)),
                  selected: _sameDay(_weekStart.add(Duration(days: index)), selectedDay),
                  bookable: _isBookable(_weekStart.add(Duration(days: index))),
                  salonId: widget.salonId,
                  serviceId: widget.serviceId,
                  specialistId: widget.specialistId,
                  onDateSelected: widget.onDateSelected,
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        // Explicit height (not minHeight): minHeight/minimumSize kept the
        // button at zero height inside the scrollable Column, which made the
        // tap land on a sizeless box ("Cannot hit test a render box with no
        // size") and the calendar never opened.
        // ignore: sized_box_for_whitespace, explicit height + child per fix spec
        Container(
          key: _dateButtonBoxKey,
          height: 48,
          width: double.infinity,
          child: OutlinedButton.icon(
            key: const ValueKey('date-button'),
            icon: const Icon(Icons.calendar_month, color: BoyaColors.primary),
            label: Text(
              formatJalaliDate(widget.selectedDate),
              style: BoyaTypography.body.copyWith(fontWeight: FontWeight.w600),
            ),
            onPressed: _openCalendar,
          ),
        ),
      ],
    );
  }

  /// 1-based week offset from this week; today is always week ۱.
  int get _weekNumber =>
      _weekStart.difference(jalaliWeekStart(_firstDate)).inDays ~/ 7 + 1;
}

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

DateTime _clamp(DateTime value, DateTime start, DateTime end) {
  if (value.isBefore(start)) return start;
  if (value.isAfter(end)) return end;
  return value;
}

/// Every Friday inside [start, .., end], for the picker's holiday marking.
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

/// One cell of the week strip. A bookable day carries an availability dot:
/// green when the salon still has a free slot that day, red when the day is
/// full. Friday, past, and out-of-range days stay grey and inert.
class _DayCell extends ConsumerWidget {
  const _DayCell({
    required this.date,
    required this.selected,
    required this.bookable,
    required this.salonId,
    required this.serviceId,
    required this.specialistId,
    required this.onDateSelected,
  });

  final DateTime date;
  final bool selected;
  final bool bookable;
  final String salonId;
  final String serviceId;
  final String? specialistId;
  final ValueChanged<DateTime> onDateSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friday = isFriday(date);
    Color? dotColor;
    if (bookable && salonId.isNotEmpty && serviceId.isNotEmpty) {
      // Temporary trace: confirms the family key (salonId/serviceId/
      // specialistId/date) is watched and the provider fires on first build.
      debugPrint(
        'availableSlotsProvider → '
        'salonId=$salonId '
        'serviceId=$serviceId '
        'specialistId=$specialistId '
        'date=$date',
      );
      final slots = ref
          .watch(
            availableSlotsProvider((
              salonId: salonId,
              date: DateTime(date.year, date.month, date.day),
              serviceId: serviceId,
              specialistId: specialistId,
            )),
          )
          .asData
          ?.value;
      if (slots != null) {
        dotColor = slots.any((slot) => slot.available) ? BoyaColors.success : BoyaColors.error;
      }
    }
    final background = selected
        ? BoyaColors.primary
        : friday
            ? BoyaColors.errorSubtle
            : bookable
                ? BoyaColors.surface
                : BoyaColors.cream;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Material(
        color: background,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: selected
                ? BoyaColors.primary
                : friday
                    ? BoyaColors.error
                    : BoyaColors.line,
          ),
        ),
        child: InkWell(
          onTap: bookable ? () => onDateSelected(date) : null,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  persianDayName(date),
                  style: BoyaTypography.overline.copyWith(
                    color: selected ? BoyaColors.white : BoyaColors.inkMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  toPersianDigits(toJalali(date).day),
                  style: BoyaTypography.caption.copyWith(
                    color: selected ? BoyaColors.white : BoyaColors.ink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                if (dotColor != null)
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                  )
                else
                  Text(
                    friday ? 'تعطیل' : '',
                    style: BoyaTypography.overline.copyWith(fontSize: 10),
                    textAlign: TextAlign.center,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Month grid used only when `showParsiDatePicker` cannot render. Days are
/// picked straight from the grid; Friday and out-of-range days stay inert.
class _MonthPickerDialog extends StatefulWidget {
  const _MonthPickerDialog({required this.initial, required this.start, required this.end});

  final DateTime initial;
  final DateTime start;
  final DateTime end;

  @override
  State<_MonthPickerDialog> createState() => _MonthPickerDialogState();
}

class _MonthPickerDialogState extends State<_MonthPickerDialog> {
  late DateTime _monthFirst;

  @override
  void initState() {
    super.initState();
    _monthFirst = _firstOfMonth(widget.initial);
  }

  DateTime get _startMonth => _firstOfMonth(widget.start);

  DateTime get _endMonth => _firstOfMonth(widget.end);

  /// Civil day count of the Jalali month opening on [_monthFirst].
  int get _daysInMonth {
    final parts = toJalali(_monthFirst);
    var count = 0;
    var cursor = _monthFirst;
    while (count < 31) {
      final probe = toJalali(cursor);
      if (probe.year != parts.year || probe.month != parts.month) break;
      count += 1;
      cursor = cursor.add(const Duration(days: 1));
    }
    return count;
  }

  bool get _canGoPrevious => _monthFirst.isAfter(_startMonth);

  bool get _canGoNext =>
      !_firstOfMonth(_monthFirst.add(Duration(days: _daysInMonth))).isAfter(_endMonth);

  @override
  Widget build(BuildContext context) {
    final parts = toJalali(_monthFirst);
    final leading = jalaliWeekdayIndex(_monthFirst);
    return AlertDialog(
      title: Text(
        '${persianMonthName(parts.month)} ${toPersianDigits(parts.year)}',
        style: BoyaTypography.title,
        textAlign: TextAlign.center,
      ),
      content: SizedBox(
        width: 320,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                IconButton(
                  onPressed: _canGoPrevious
                      ? () => setState(
                          () => _monthFirst = _firstOfMonth(
                            _monthFirst.subtract(const Duration(days: 1)),
                          ),
                        )
                      : null,
                  icon: const Icon(Icons.chevron_right),
                ),
                Expanded(
                  child: Text(
                    persianMonthName(parts.month),
                    style: BoyaTypography.body,
                    textAlign: TextAlign.center,
                  ),
                ),
                IconButton(
                  onPressed: _canGoNext
                      ? () => setState(
                          () => _monthFirst = _firstOfMonth(
                            _monthFirst.add(Duration(days: _daysInMonth)),
                          ),
                        )
                      : null,
                  icon: const Icon(Icons.chevron_left),
                ),
              ],
            ),
            Row(
              children: [
                for (final name in persianDayNames)
                  Expanded(
                    child: Text(
                      name,
                      style: BoyaTypography.overline,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            GridView.count(
              crossAxisCount: 7,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              childAspectRatio: 0.9,
              children: [
                for (var i = 0; i < leading; i++) const SizedBox.shrink(),
                // Civil day of Jalali `day`: `_monthFirst` is already day 1, so
                // the offset is `day - 1`, not `leading + day - 1` (the leading
                // blanks already occupy the first `leading` grid slots). Using
                // the leading gap again shifted every pick forward by a week.
                for (var day = 1; day <= _daysInMonth; day++)
                  _dayCell(_monthFirst.add(Duration(days: day - 1)), day),
              ],
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('انصراف'),
        ),
      ],
    );
  }

  Widget _dayCell(DateTime civil, int day) {
    final start = DateTime(widget.start.year, widget.start.month, widget.start.day);
    final end = DateTime(widget.end.year, widget.end.month, widget.end.day);
    final disabled = civil.isBefore(start) || civil.isAfter(end) || isFriday(civil);
    return InkWell(
      onTap: disabled ? null : () => Navigator.of(context).pop(civil),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: disabled ? BoyaColors.cream : BoyaColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: BoyaColors.line),
        ),
        child: Text(
          toPersianDigits(day),
          style: BoyaTypography.caption.copyWith(
            color: disabled ? BoyaColors.inkMuted : BoyaColors.ink,
          ),
        ),
      ),
    );
  }
}

/// Civil day one of the Jalali month containing [day].
DateTime _firstOfMonth(DateTime day) {
  final parts = toJalali(day);
  return DateTime(day.year, day.month, day.day).subtract(Duration(days: parts.day - 1));
}


