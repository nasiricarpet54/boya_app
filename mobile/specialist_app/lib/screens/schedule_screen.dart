import 'package:flutter/material.dart';
import 'package:boya_shared/boya_shared.dart';
import 'package:boya_shared/widgets/boya_time_slot.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  DateTime _current = DateTime.now();

  // Mock data for pilot phase
  final List<Map<String, dynamic>> slots = [
    {'time': '09:00', 'status': SlotStatus.free},
    {'time': '10:00', 'status': SlotStatus.free},
    {'time': '11:00', 'status': SlotStatus.booked, 'title': 'نوبت بویا - علی'},
    {'time': '12:00', 'status': SlotStatus.blocked},
    {'time': '13:00', 'status': SlotStatus.free},
  ];

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

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
    return Scaffold(
      appBar: AppBar(
        title: const Text('برنامه کاری من', style: BoyaTypography.headline),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'نمای روزانه'), Tab(text: 'نمای هفتگی')],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _buildDayView(),
          const Center(child: Text('نمای هفتگی', style: BoyaTypography.body)),
        ],
      ),
    );
  }

  Widget _buildDayView() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_right),
                onPressed:
                    () => setState(
                      () =>
                          _current = _current.subtract(const Duration(days: 1)),
                    ),
              ),
              Text(formatJalaliDate(_current), style: BoyaTypography.title),
              IconButton(
                icon: const Icon(Icons.chevron_left),
                onPressed:
                    () => setState(
                      () => _current = _current.add(const Duration(days: 1)),
                    ),
              ),
            ],
          ),
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
