import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

class MyScheduleScreen extends StatelessWidget {
  const MyScheduleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final start = jalaliWeekStart(DateTime.now());
    final days = [for (var i = 0; i < 7; i++) start.add(Duration(days: i))];
    return Scaffold(
      appBar: AppBar(title: const Text('برنامه هفتگی')),
      body: ListView(
        children: [
          for (final day in days)
            ListTile(
              title: Text(persianDayName(day), style: BoyaTypography.body),
              subtitle: Text(formatJalaliLong(day), style: BoyaTypography.caption),
              trailing: Text(
                isFriday(day) ? 'تعطیل' : 'ثبت نشده',
                style: BoyaTypography.caption.copyWith(color: isFriday(day) ? BoyaColors.error : BoyaColors.inkMuted),
              ),
            ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'تغییر دسترسی و مرخصی تا وقتی ساعت کاری ذخیره شود ممکن نیست. تداخل نوبت جداگانه اعلام می‌شود.',
              style: BoyaTypography.body,
            ),
          ),
        ],
      ),
    );
  }
}
