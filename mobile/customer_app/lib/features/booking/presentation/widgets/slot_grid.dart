import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../salon/domain/available_slot.dart';
import 'booking_choices.dart';

/// Step 4 of the booking form: the day's real slots as a chip grid.
///
/// Busy slots stay visible but disabled; a day without any slot reuses
/// [SlotNotice] so the "no times for this day" message stays consistent.
class SlotGrid extends StatelessWidget {
  const SlotGrid({
    required this.slots,
    required this.date,
    required this.selectedSlot,
    required this.onSlot,
    super.key,
  });

  final AsyncValue<List<AvailableSlot>> slots;
  final DateTime date;
  final AvailableSlot? selectedSlot;
  final ValueChanged<AvailableSlot> onSlot;

  @override
  Widget build(BuildContext context) {
    return slots.when(
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: CircularProgressIndicator(color: BoyaColors.primary),
        ),
      ),
      error: (_, _) => Padding(
        padding: const EdgeInsets.all(8),
        child: Text('��� �� ��?��� ������? ���?', style: BoyaTypography.caption),
      ),
      data: (list) {
        if (list.isEmpty) return SlotNotice(date: date);
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final slot in list)
              _SlotChip(
                slot: slot,
                selected: _sameSlot(slot, selectedSlot),
                onTap: () => onSlot(slot),
              ),
          ],
        );
      },
    );
  }
}

bool _sameSlot(AvailableSlot? a, AvailableSlot? b) =>
    a != null && b != null && a.start == b.start && a.end == b.end;

class _SlotChip extends StatelessWidget {
  const _SlotChip({required this.slot, required this.selected, required this.onTap});

  final AvailableSlot slot;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = slot.available;
    final background = selected ? BoyaColors.primary : BoyaColors.surface;
    final foreground = selected
        ? BoyaColors.white
        : enabled
            ? BoyaColors.ink
            : BoyaColors.inkMuted;
    return Material(
      color: background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: selected ? BoyaColors.primary : BoyaColors.line),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            toPersianDigits(slot.start),
            style: BoyaTypography.caption.copyWith(
              color: foreground,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}