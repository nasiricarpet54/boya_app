import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/home_providers.dart';
import '../../domain/salon_summary.dart';

/// Snappfood-style salon row: 100x100 cover on the right, details in the
/// middle, favourite toggle on the left.
class SalonCard extends ConsumerWidget {
  const SalonCard({required this.salon, super.key});

  final SalonSummary salon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavorite = ref.watch(favoriteSalonsProvider).contains(salon.id);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Card(
        clipBehavior: Clip.antiAlias,
        elevation: 1,
        shadowColor: BoyaColors.ink.withValues(alpha: 0.4),
        child: InkWell(
          onTap: () => context.push('/salon/${salon.id}'),
          child: SizedBox(
            height: 120,
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  _SalonThumb(salon: salon),
                  const SizedBox(width: 12),
                  Expanded(child: _SalonInfo(salon: salon)),
                  IconButton(
                    onPressed: () => ref.read(favoriteSalonsProvider.notifier).toggle(salon.id),
                    tooltip: isFavorite ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی',
                    iconSize: 20,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    icon: Icon(
                      isFavorite ? Icons.favorite : Icons.favorite_border,
                      color: isFavorite ? BoyaColors.error : BoyaColors.inkMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SalonThumb extends StatelessWidget {
  const _SalonThumb({required this.salon});

  final SalonSummary salon;

  @override
  Widget build(BuildContext context) {
    final discount = salon.discountPercent;
    return SizedBox(
      width: 100,
      height: 100,
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                salon.imageUrl,
                fit: BoxFit.cover,
                loadingBuilder: (context, child, progress) =>
                    progress == null ? child : const ColoredBox(color: BoyaColors.primarySubtle),
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: BoyaColors.primarySubtle,
                  child: Center(child: Icon(Icons.storefront_outlined, color: BoyaColors.primary)),
                ),
              ),
            ),
          ),
          if (discount != null)
            Positioned(
              top: 6,
              right: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: BoyaColors.error,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${toPersianDigits(discount)}٪ تخفیف',
                  style: BoyaTypography.overline.copyWith(
                    color: BoyaColors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SalonInfo extends StatelessWidget {
  const _SalonInfo({required this.salon});

  final SalonSummary salon;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          salon.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: BoyaTypography.caption.copyWith(color: BoyaColors.ink, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            const Icon(Icons.star, size: 14, color: BoyaColors.warning),
            const SizedBox(width: 2),
            Expanded(
              child: Text(
                '${_persianDecimal(salon.rating)} · ${toPersianDigits(salon.reviewCount)} نظر · '
                '${_persianDecimal(salon.distanceKm)} کیلومتر',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: BoyaTypography.overline,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          salon.tags.join('، '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: BoyaTypography.overline.copyWith(fontSize: 11),
        ),
        const SizedBox(height: 4),
        Text(
          'شروع قیمت از ${formatPrice(salon.minPrice)}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: BoyaTypography.overline.copyWith(color: BoyaColors.ink, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

/// `2.3` becomes `۲٫۳` with the Persian decimal separator.
String _persianDecimal(double value) =>
    toPersianDigits(value.toStringAsFixed(1)).replaceAll('.', '٫');
