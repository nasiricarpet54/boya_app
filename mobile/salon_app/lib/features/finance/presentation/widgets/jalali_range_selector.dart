import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

enum FinancePreset { thisMonth, lastMonth, threeMonths }

class JalaliRangeSelector extends StatelessWidget {
  const JalaliRangeSelector({required this.preset, required this.onPreset, super.key});

  final FinancePreset preset;
  final ValueChanged<FinancePreset> onPreset;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: [
        _Chip(label: 'این ماه', selected: preset == FinancePreset.thisMonth, onTap: () => onPreset(FinancePreset.thisMonth)),
        _Chip(label: 'ماه گذشته', selected: preset == FinancePreset.lastMonth, onTap: () => onPreset(FinancePreset.lastMonth)),
        _Chip(label: 'سه ماه اخیر', selected: preset == FinancePreset.threeMonths, onTap: () => onPreset(FinancePreset.threeMonths)),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: BoyaColors.primarySubtle,
      onSelected: (_) => onTap(),
    );
  }
}

String jalaliRangeLabel(FinancePreset preset, DateTime now) {
  final parts = toJalali(now);
  final current = '${persianMonthName(parts.month)} ${toPersianDigits(parts.year)}';
  return switch (preset) {
    FinancePreset.thisMonth => current,
    FinancePreset.lastMonth => 'ماه پیش از $current',
    FinancePreset.threeMonths => 'سه ماه تا $current',
  };
}
