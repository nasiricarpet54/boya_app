import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/home_providers.dart';

/// Horizontal filter row between the banner and the salon list.
class FilterChips extends ConsumerWidget {
  const FilterChips({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = ref.watch(homeFilterProvider);
    // ADR-011: the «خدمات سیار» chip is rendered as the last item of the same
    // row so it reads as one more filter, but it is backed by its own boolean
    // provider — the single-select labels above cannot express "and also mobile".
    final mobileOnly = ref.watch(homeMobileFilterProvider);
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: homeFilterLabels.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (index == homeFilterLabels.length) {
            return _FilterChip(
              label: 'خدمات سیار',
              icon: Icons.directions_car,
              selected: mobileOnly,
              onTap: () => ref.read(homeMobileFilterProvider.notifier).toggle(),
            );
          }
          final label = homeFilterLabels[index];
          return _FilterChip(
            label: label,
            selected: label == active,
            onTap: () => ref.read(homeFilterProvider.notifier).select(label),
          );
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap, this.icon});

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? BoyaColors.primary : BoyaColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: selected ? BoyaColors.primary : BoyaColors.line),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 14, color: selected ? BoyaColors.white : BoyaColors.primary),
                  const SizedBox(width: 6),
                ],
                Text(
                  label,
                  style: BoyaTypography.caption.copyWith(
                    color: selected ? BoyaColors.white : BoyaColors.ink,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
