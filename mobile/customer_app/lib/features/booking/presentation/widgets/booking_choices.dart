import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

class BookingChoice extends StatelessWidget {
  const BookingChoice({required this.title, required this.selected, required this.onTap, super.key, this.trailing});

  final String title;
  final String? trailing;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: selected ? BoyaColors.primary : BoyaColors.line, width: selected ? 2 : 1),
      ),
      child: ListTile(
        onTap: onTap,
        title: Text(title, style: BoyaTypography.body),
        trailing: trailing == null ? null : Text(trailing!, style: BoyaTypography.caption),
        selected: selected,
      ),
    );
  }
}

class SlotNotice extends StatelessWidget {
  const SlotNotice({required this.date, super.key});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final friday = isFriday(date);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: BoyaColors.surface, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Icon(friday ? Icons.weekend : Icons.event_busy, size: 48, color: BoyaColors.inkMuted),
          const SizedBox(height: 12),
          Text(friday ? '���� ���?� ���' : 'زمان خالی برای این روز وجود ندارد', style: BoyaTypography.body),
          const SizedBox(height: 4),
          Text(formatJalaliFull(date), style: BoyaTypography.caption),
        ],
      ),
    );
  }
}
