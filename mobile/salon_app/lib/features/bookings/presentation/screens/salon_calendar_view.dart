import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/salon_app_bar.dart';
import '../widgets/month_pane.dart';

class SalonCalendarView extends ConsumerStatefulWidget {
  const SalonCalendarView({super.key});

  @override
  ConsumerState<SalonCalendarView> createState() => _SalonCalendarViewState();
}

class _SalonCalendarViewState extends ConsumerState<SalonCalendarView> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  DateTime _current = DateTime.now();
  DateTime? _selected;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: SalonAppBar(
        title: 'تقویم رزروها',
        bottom: TabBar(controller: _tabs, tabs: const [Tab(text: 'نمای هفتگی'), Tab(text: 'نمای ماهانه')]),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          WeekPane(
            current: _current,
            onShift: (delta) => setState(() => _current = _current.add(Duration(days: 7 * delta))),
          ),
          MonthPane(
            current: _current,
            selected: _selected,
            onShift: (delta) => setState(() => _current = DateTime(_current.year, _current.month + delta, 1)),
            onSelect: (day) => setState(() => _selected = day),
          ),
        ],
      ),
    );
  }
}

class WeekPane extends StatelessWidget {
  const WeekPane({required this.current, required this.onShift, super.key});

  final DateTime current;
  final ValueChanged<int> onShift;

  @override
  Widget build(BuildContext context) {
    final start = jalaliWeekStart(current);
    final days = [for (var i = 0; i < 7; i++) start.add(Duration(days: i))];
    return Column(
      children: [
        CalendarNav(label: '${formatJalaliDate(start)} تا ${formatJalaliDate(days.last)}', onShift: onShift),
        Row(
          children: [
            for (final day in days)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      Text(persianDayName(day), style: BoyaTypography.overline.copyWith(color: isFriday(day) ? BoyaColors.error : BoyaColors.inkMuted)),
                      Text(toPersianDigits('${toJalali(day).day}'), style: BoyaTypography.title.copyWith(color: isFriday(day) ? BoyaColors.error : BoyaColors.ink)),
                      if (isFriday(day)) Text('تعطیل', style: BoyaTypography.overline.copyWith(color: BoyaColors.error)),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const Expanded(child: Center(child: Text('رزروی برای این هفته ثبت نشده', style: BoyaTypography.body))),
      ],
    );
  }
}
