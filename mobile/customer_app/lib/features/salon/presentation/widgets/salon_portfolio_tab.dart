import 'package:boya_shared/boya_shared.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import '../../data/salon_api.dart';
import '../../domain/salon_detail.dart';
import 'salon_portfolio_viewer.dart';

/// The salon detail page's «نمونه‌کارها» tab: a 3-column grid of the salon's
/// specialist portfolio photos, with an optional per-specialist filter.
///
/// [specialistId] is the filter currently active on the page — the specialist
/// the customer picked elsewhere on the screen, or the one tapped in the strip
/// above. Null shows every specialist's work. Filtering happens here, on the
/// already-loaded list, so switching the filter is instant and never refetches.
class SalonPortfolioTab extends ConsumerStatefulWidget {
  const SalonPortfolioTab({required this.salonId, this.specialistId, super.key});

  final String salonId;
  final String? specialistId;

  @override
  ConsumerState<SalonPortfolioTab> createState() => _SalonPortfolioTabState();
}

class _SalonPortfolioTabState extends ConsumerState<SalonPortfolioTab>
    with AutomaticKeepAliveClientMixin {
  /// Which specialist the customer tapped inside the tab. Starts unset on every
  /// build of the widget and pairs with [widget.specialistId], which lives on
  /// the page rather than in the tab.
  String? _pickedSpecialistId;

  /// The tab stays mounted while the customer moves between tabs, so the grid
  /// and its scroll position survive a round trip.
  @override
  bool get wantKeepAlive => true;

  String? get _filterId => _pickedSpecialistId ?? widget.specialistId;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final async = ref.watch(salonPortfolioProvider(widget.salonId));

    return async.when(
      loading: () => const SalonPortfolioSkeleton(),
      error: (_, _) => const Center(child: _PortfolioEmptyOrError('��� �� ��?��� ����坘����')),
      data: (items) {
        final usable = items.where((item) => item.isUsable).toList(growable: false);
        if (usable.isEmpty) return const Center(child: _PortfolioEmptyOrError('هنوز نمونه‌کاری ثبت نشده'));

        final filterId = _filterId;
        final filtered = filterId == null
            ? usable
            : usable.where((item) => item.specialistId == filterId).toList(growable: false);
        // A salon can name a specialist who never uploaded a photo, so the
        // filter can legitimately come back empty. The chips stay visible in
        // that case, otherwise there would be no way back to «همه».
        final chips = _buildChips(usable);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            chips,
            if (filtered.isEmpty)
              const Center(child: _PortfolioEmptyOrError('هنوز نمونه‌کاری ثبت نشده'))
            else
              GridView.builder(
                // The tab lives inside the page's CustomScrollView, so the grid
                // must size itself instead of claiming the whole viewport.
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                ),
                itemCount: filtered.length,
                itemBuilder: (context, index) => _PortfolioGridItem(
                  item: filtered[index],
                  onTap: () => showPortfolioViewer(context, filtered, index),
                ),
              ),
          ],
        );
      },
    );
  }

  /// Filter chips, one per specialist that actually has photos. A single
  /// specialist means there is nothing to choose, so no chips are shown.
  Widget _buildChips(List<PortfolioItem> items) {
    final names = <String, String>{};
    for (final item in items) {
      final name = item.specialistName;
      if (name != null && name.isNotEmpty) names.putIfAbsent(item.specialistId, () => name);
    }
    if (names.length < 2) return const SizedBox.shrink();

    final filterId = _filterId;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          _FilterChip(
            label: 'همه',
            selected: filterId == null,
            onSelected: () => setState(() => _pickedSpecialistId = null),
          ),
          for (final entry in names.entries) ...[
            const SizedBox(width: 8),
            _FilterChip(
              label: entry.value,
              selected: filterId == entry.key,
              onSelected: () => setState(() => _pickedSpecialistId = entry.key),
            ),
          ],
        ],
      ),
    );
  }
}

/// Shown while the portfolio request is in flight: one [Shimmer] around the
/// whole grid, which is cheaper than animating each tile on its own.
class SalonPortfolioSkeleton extends StatelessWidget {
  const SalonPortfolioSkeleton({this.tileCount = 9, super.key});

  final int tileCount;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: BoyaColors.line,
      highlightColor: BoyaColors.cream,
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
        ),
        itemCount: tileCount,
        itemBuilder: (context, index) => DecoratedBox(
          decoration: BoxDecoration(
            color: BoyaColors.line,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}

class _PortfolioGridItem extends StatelessWidget {
  const _PortfolioGridItem({required this.item, required this.onTap});

  final PortfolioItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = item.specialistName;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Expanded(child: _PortfolioTile(item: item, onTap: onTap)),
        if (name != null && name.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: BoyaTypography.fontFamily,
                fontSize: 10,
                color: BoyaColors.inkMuted,
              ),
            ),
          ),
      ],
    );
  }
}

class _PortfolioTile extends StatelessWidget {
  const _PortfolioTile({required this.item, required this.onTap});

  final PortfolioItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tag = portfolioHeroTag(item);
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Hero(
            tag: tag,
            child: CachedNetworkImage(
              imageUrl: item.imageUrl,
              fit: BoxFit.cover,
              // Loading state: a shimmer sweep over a neutral tile instead of a
              // blank box, so a slow/blocked host (e.g. picsum.photos in Iran)
              // never leaves an empty hole in the grid.
              placeholder: (_, _) => Shimmer.fromColors(
                baseColor: BoyaColors.line,
                highlightColor: BoyaColors.cream,
                child: const ColoredBox(color: BoyaColors.line),
              ),
              // Error state: a solid tile with an image icon. `errorWidget` is
              // the stable fallback for CachedNetworkImage; it is also what
              // Chrome shows when the request is blocked outright, so the grid
              // keeps its 3-column rhythm instead of collapsing.
              errorWidget: (_, _, _) => const ColoredBox(
                color: BoyaColors.primarySubtle,
                child: Center(
                  child: Icon(Icons.image_outlined, size: 24, color: BoyaColors.inkMuted),
                ),
              ),
            ),
          ),
          // Tap target above the image: a Stack child does not take the tap by
          // itself, and the highlight should cover the whole tile.
          Positioned.fill(
            child: Material(
              color: Colors.transparent,
              child: InkWell(onTap: onTap, splashColor: BoyaColors.primary.withValues(alpha: 0.2)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shared [Hero] tag of a portfolio photo, so the grid tile and the full-screen
/// viewer animate into each other through the same id.
String portfolioHeroTag(PortfolioItem item) => 'portfolio-image-${item.id}';

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onSelected});

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
      labelStyle: BoyaTypography.caption.copyWith(
        color: selected ? BoyaColors.white : BoyaColors.ink,
        fontWeight: FontWeight.w600,
      ),
      backgroundColor: BoyaColors.surface,
      selectedColor: BoyaColors.primary,
      side: const BorderSide(color: BoyaColors.line),
    );
  }
}

class _PortfolioEmptyOrError extends StatelessWidget {
  const _PortfolioEmptyOrError(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Icon(Icons.photo_library_outlined, size: 40, color: BoyaColors.line),
          const SizedBox(height: 8),
          Text(text, style: BoyaTypography.caption),
        ],
      ),
    );
  }
}
