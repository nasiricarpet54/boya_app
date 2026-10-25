import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:boya_shared/widgets/boya_time_slot.dart';

import '../../../../shared/widgets/salon_app_bar.dart';
import '../widgets/month_pane.dart';

class SalonCalendarView extends ConsumerStatefulWidget {
  const SalonCalendarView({super.key});

  @override
  ConsumerState<SalonCalendarView> createState() => _SalonCalendarViewState();
}

class _SalonCalendarViewState extends ConsumerState<SalonCalendarView>
    with SingleTickerProviderStateMixin {
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
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'نمای هفتگی'), Tab(text: 'نمای روزانه')],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          WeekPane(
            current: _current,
            onShift:
                (delta) => setState(
                  () => _current = _current.add(Duration(days: 7 * delta)),
                ),
          ),
          DayPane(
            current: _selected ?? _current,
            onShift:
                (delta) => setState(
                  () =>
                      _selected = (_selected ?? _current).add(
                        Duration(days: delta),
                      ),
                ),
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
        CalendarNav(
          label: '${formatJalaliDate(start)} تا ${formatJalaliDate(days.last)}',
          onShift: onShift,
        ),
        Row(
          children: [
            for (final day in days)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      Text(
                        persianDayName(day),
                        style: BoyaTypography.overline.copyWith(
                          color:
                              isFriday(day)
                                  ? BoyaColors.error
                                  : BoyaColors.inkMuted,
                        ),
                      ),
                      Text(
                        toPersianDigits('${toJalali(day).day}'),
                        style: BoyaTypography.title.copyWith(
                          color:
                              isFriday(day) ? BoyaColors.error : BoyaColors.ink,
                        ),
                      ),
                      if (isFriday(day))
                        Text(
                          'تعطیل',
                          style: BoyaTypography.overline.copyWith(
                            color: BoyaColors.error,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const Expanded(
          child: Center(
            child: Text(
              'برای مدیریت ساعت‌ها به نمای روزانه بروید',
              style: BoyaTypography.body,
            ),
          ),
        ),
      ],
    );
  }
}

class DayPane extends StatefulWidget {
  final DateTime current;
  final ValueChanged<int> onShift;

  const DayPane({required this.current, required this.onShift, super.key});

  @override
  State<DayPane> createState() => _DayPaneState();
}

class _DayPaneState extends State<DayPane> {
  // Mock data for pilot phase
  final List<Map<String, dynamic>> slots = [
    {'time': '09:00', 'status': SlotStatus.free},
    {'time': '10:00', 'status': SlotStatus.booked, 'title': 'نوبت بویا - سارا'},
    {'time': '11:00', 'status': SlotStatus.blocked},
    {'time': '12:00', 'status': SlotStatus.free},
    {'time': '13:00', 'status': SlotStatus.free},
  ];

  void _handleTap(int index) {
    final slot = slots[index];
    if (slot['status'] == SlotStatus.free) {
      BoyaTimeSlotActionSheet.showFreeSlotOptions(
        context,
        () => setState(() => slots[index]['status'] = SlotStatus.blocked),
        () => setState(() {
          slots[index]['status'] = SlotStatus.blocked;
          slots[index]['title'] = 'ساعت استراحت';
        }),
      );
    } else if (slot['status'] == SlotStatus.blocked) {
      BoyaTimeSlotActionSheet.showBlockedSlotOptions(
        context,
        () => setState(() {
          slots[index]['status'] = SlotStatus.free;
          slots[index]['title'] = null;
        }),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        CalendarNav(
          label: formatJalaliDate(widget.current),
          onShift: widget.onShift,
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: slots.length,
            itemBuilder: (context, index) {
              final slot = slots[index];
              return BoyaTimeSlot(
                timeLabel: slot['time'] as String,
                status: slot['status'] as SlotStatus,
                title: slot['title'] as String?,
                onTap: () => _handleTap(index),
              );
            },
          ),
        ),
      ],
    );
  }
}
