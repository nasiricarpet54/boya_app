import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/mobile_badge.dart';
import '../../domain/salon_detail.dart';

class SalonServiceTile extends StatelessWidget {
  const SalonServiceTile({required this.service, super.key});

  final SalonService service;

  @override
  Widget build(BuildContext context) {
    // The name used to live in a [ListTile] whose theme-driven title style
    // could render the label in the surface color (invisible on cream), so the
    // price alone was visible. A plain row with explicit ink-colored text makes
    // the service name dependable regardless of the ambient [ListTileTheme].
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text(
              service.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: BoyaTypography.body.copyWith(color: BoyaColors.ink),
            ),
          ),
          // ADR-011: the «سیار» pill sits between the name and the price so a
          // service that can leave the salon is visible without tapping it.
          if (service.isMobileAvailable) ...[
            const SizedBox(width: 8),
            const MobileBadge(dense: true),
          ],
          const SizedBox(width: 12),
          Text(
            formatPrice(service.price),
            style: BoyaTypography.caption.copyWith(
              color: BoyaColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class SalonSpecialistStrip extends StatelessWidget {
  const SalonSpecialistStrip({
    required this.specialists,
    this.selectedId,
    this.onSelected,
    super.key,
  });

  final List<SalonSpecialist> specialists;

  /// Highlighted card, or null when nobody is selected.
  final String? selectedId;

  /// Called with the tapped specialist's id. Null keeps the placeholder snack
  /// bar, which is what the strip did before it became tappable.
  final ValueChanged<String>? onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 148,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: specialists.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final specialist = specialists[index];
          final selected = specialist.id == selectedId;
          return SizedBox(
            width: 140,
            child: Card(
              color: BoyaColors.surface,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: selected ? BoyaColors.primary : BoyaColors.line,
                  width: selected ? 2 : 1,
                ),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => onSelected == null
                    ? ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('جزئیات متخصص به‌زودی')),
                      )
                    : onSelected!(specialist.id),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircleAvatar(
                        backgroundColor:
                            selected ? BoyaColors.primary : BoyaColors.primarySubtle,
                        child: Icon(
                          Icons.person,
                          color: selected ? BoyaColors.white : BoyaColors.primary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        specialist.fullName,
                        style: BoyaTypography.caption.copyWith(color: BoyaColors.ink),
                        textAlign: TextAlign.center,
                      ),
                      // ADR-011: only a specialist whose profile says they offer
                      // mobile service gets the «سیار» pill, because the booking
                      // form lets the customer request one.
                      if (specialist.offersMobileService) ...[
                        const SizedBox(height: 6),
                        const MobileBadge(),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
