import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../application/home_providers.dart';
import '../../data/salon_api.dart';
import '../../domain/salon_summary.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/category_grid.dart';
import '../widgets/filter_chips.dart';
import '../widgets/promo_banner.dart';
import '../widgets/salon_card.dart';
import '../widgets/search_bar.dart';
import '../widgets/top_bar.dart';

/// Salons around [locationProvider], nearest first, optionally filtered by
/// [selectedCategoryProvider].
///
/// This mirrors [nearbySalonsProvider] but lets errors surface: the shared
/// provider catches every failure and returns an empty list so the search
/// screen degrades gracefully, whereas the home feed needs the failure to
/// render its retry button. Defined here rather than in `home_providers.dart`
/// because only this screen consumes it.
final homeSalonsProvider = FutureProvider<List<SalonSummary>>((ref) async {
  final location = ref.watch(locationProvider);
  final categorySlug = ref.watch(selectedCategoryProvider);

  return ref.watch(salonsApiProvider).getSalons(
        lat: location.lat,
        lng: location.lng,
        categorySlug: categorySlug?.isNotEmpty == true ? categorySlug : null,
        sort: 'distance',
      );
});

/// Snappfood-style landing screen: header, search, categories, banner,
/// filters and the nearby salon feed.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      body: RefreshIndicator(
        // Invalidate then await the fresh future so the spinner stays visible
        // for as long as the refetch actually takes.
        onRefresh: () async {
          ref.invalidate(homeSalonsProvider);
          await ref.read(homeSalonsProvider.future);
        },
        child: ListView(
          // Pull-to-refresh must stay reachable even when the feed fits on one
          // screen, which is the common case below the fold on a short list.
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            const HomeTopBar(),
            const SizedBox(height: 12),
            HomeSearchBar(onTap: () => context.push('/search')),
            const SizedBox(height: 16),
            const CategoryGrid(),
            const SizedBox(height: 16),
            const PromoBanner(),
            const SizedBox(height: 16),
            const FilterChips(),
            const SizedBox(height: 8),
            _SectionHeader(
              title: 'سالن‌های اطراف شما',
              // The full salon listing screen is not built yet.
              onSeeAll: () {},
            ),
            const _NearbySalons(),
            const SizedBox(height: 16),
          ],
        ),
      ),
      bottomNavigationBar: HomeBottomNav(
        currentIndex: 0,
        onSelect: (index) => _onTabSelected(context, index),
      ),
    );
  }
}

/// The salon feed with explicit loading, error, empty and success states.
///
/// The list layout is unchanged from before: one full-width [SalonCard] per
/// row. `when` only swaps what fills the section, never its shape.
class _NearbySalons extends ConsumerWidget {
  const _NearbySalons();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final salonsAsync = ref.watch(homeSalonsProvider);
    return salonsAsync.when(
      loading: () => const _SalonShimmerList(),
      error: (_, _) => _SalonFeedError(
        onRetry: () => ref.invalidate(homeSalonsProvider),
      ),
      data: (salons) {
        if (salons.isEmpty) {
          return const _SalonFeedEmpty();
        }
        return Column(
          children: [for (final salon in salons) SalonCard(salon: salon)],
        );
      },
    );
  }
}

void _onTabSelected(BuildContext context, int index) {
  switch (index) {
    case 0:
      // Already on home.
      break;
    case 1:
      context.go('/profile/bookings');
      break;
    case 2:
      // Offers screen is not built yet.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تخفیف‌ها به‌زودی')),
      );
      break;
    case 3:
      context.go('/profile');
      break;
    default:
      break;
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.onSeeAll});

  final String title;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          Expanded(child: Text(title, style: BoyaTypography.title.copyWith(fontSize: 18))),
          TextButton(
            onPressed: onSeeAll,
            style: TextButton.styleFrom(
              foregroundColor: BoyaColors.primary,
              textStyle: BoyaTypography.caption.copyWith(fontWeight: FontWeight.w600),
            ),
            child: const Text('مشاهده همه'),
          ),
        ],
      ),
    );
  }
}

/// Three shimmer placeholders shaped like a [SalonCard] so the feed does not
/// jump when the real rows arrive.
class _SalonShimmerList extends StatelessWidget {
  const _SalonShimmerList();

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: BoyaColors.line,
      highlightColor: BoyaColors.primarySubtle,
      child: const Column(
        children: [
          _SalonCardPlaceholder(),
          _SalonCardPlaceholder(),
          _SalonCardPlaceholder(),
        ],
      ),
    );
  }
}

class _SalonCardPlaceholder extends StatelessWidget {
  const _SalonCardPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Card(
        elevation: 1,
        child: SizedBox(
          height: 120,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                _bar(100, 100, 12),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _bar(150, 14, 4),
                      const SizedBox(height: 8),
                      _bar(210, 10, 4),
                      const SizedBox(height: 8),
                      _bar(110, 10, 4),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _bar(double width, double height, double radius) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: BoyaColors.white,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class _SalonFeedEmpty extends StatelessWidget {
  const _SalonFeedEmpty();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: Text(
          'سالنی در این محدوده پیدا نشد',
          style: BoyaTypography.body,
        ),
      ),
    );
  }
}

class _SalonFeedError extends StatelessWidget {
  const _SalonFeedError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'دریافت لیست سالن‌ها ناموفق بود',
              style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('تلاش دوباره'),
            ),
          ],
        ),
      ),
    );
  }
}
