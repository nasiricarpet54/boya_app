import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

class SalonWeekSection extends StatelessWidget {
  const SalonWeekSection({super.key});

  @override
  Widget build(BuildContext context) {
    final start = jalaliWeekStart(DateTime.now());
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('نوبت‌های این هفته', style: BoyaTypography.title),
          const SizedBox(height: 8),
          Text(
            'جمعه تعطیل است. ساعت کاری بقیه روزها هنوز ثبت نشده.',
            style: BoyaTypography.caption,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (var index = 0; index < 7; index++)
                Expanded(child: _DayChip(date: start.add(Duration(days: index)))),
            ],
          ),
        ],
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final friday = isFriday(date);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: friday ? BoyaColors.errorSubtle : BoyaColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: friday ? BoyaColors.error : BoyaColors.line),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            children: [
              Text(persianDayName(date), style: BoyaTypography.overline, textAlign: TextAlign.center),
              const SizedBox(height: 4),
              Text(
                toPersianDigits(toJalali(date).day),
                style: BoyaTypography.caption.copyWith(color: BoyaColors.ink),
              ),
              Text(friday ? 'تعطیل' : '—', style: BoyaTypography.overline),
            ],
          ),
        ),
      ),
    );
  }
}
