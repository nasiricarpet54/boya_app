import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/home_providers.dart';

/// Horizontal filter row between the banner and the salon list.
class FilterChips extends ConsumerWidget {
  const FilterChips({super.key});

  /// The «نزدیک من» label, which is the one chip that needs the device: tapping
  /// it asks for GPS so `locationProvider` becomes the customer, not Tehran.
  static const _nearMeLabel = 'نزدیک من';

  Future<void> _select(BuildContext context, WidgetRef ref, String label) async {
    // "همه" resets all filters
    if (label == 'همه') {
      ref.read(homeFilterProvider.notifier).select(label);
      ref.read(homeSameDayFilterProvider.notifier).select(false);
      ref.read(selectedCategoryProvider.notifier).select(null);
      ref.read(homeMobileFilterProvider.notifier).select(false);
      return;
    }
    // "پذیرش امروز" toggles the same-day acceptance filter
    if (label == 'پذیرش امروز') {
      ref.read(homeSameDayFilterProvider.notifier).toggle();
      ref.read(homeFilterProvider.notifier).select(label);
      return;
    }
    // "نزدیک من" requires GPS resolution
    if (label != _nearMeLabel) {
      ref.read(homeFilterProvider.notifier).select(label);
      return;
    }

    // Resolve first, select only on success: turning the chip on before a fix
    // would sort the feed from the default reference point — a city the
    // customer is not in — while the chip promised "near me".
    final outcome = await ref.read(userLocationProvider.notifier).resolve();
    if (!context.mounted) return;

    if (outcome == UserLocationOutcome.resolved) {
      ref.read(homeFilterProvider.notifier).select(label);
      return;
    }

    final message = switch (outcome) {
      UserLocationOutcome.positionUnavailable => '�����? �� ����?� ���? �����?� �?��',
      UserLocationOutcome.cityNotServed => '��?� �� ��� ��� ���� �?��',
      UserLocationOutcome.geocoderUnavailable => 'نزدیکترین شهر یافت نشد',
      UserLocationOutcome.resolved => '', // unreachable: selected above
    };
    if (message.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

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
            onTap: () => _select(context, ref, label),
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
