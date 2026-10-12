import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/salon_api.dart';
import '../domain/salon_summary.dart';
import '../domain/service_category.dart';

/// Filter chips above the salon list. The first entry is the default selection.
const homeFilterLabels = <String>[
  'همه',
  'باز الان',
  'نزدیک من',
  'تخفیف دار',
  'امتیاز ۴.۵+',
  'پذیرش امروز',
];

/// Centre point the "near me" feed is measured from.
///
/// Device GPS is not wired up yet, so this is Tehran's city centre. The API
/// only needs a reference point to fill in `distanceKm`; swapping this provider
/// for a real location is the only change needed later.
class HomeLocation {
  const HomeLocation({required this.lat, required this.lng});

  final double lat;
  final double lng;
}

final locationProvider = Provider<HomeLocation>(
  (ref) => const HomeLocation(lat: 35.7575, lng: 51.4100),
);

/// Category chips under the search bar.
///
/// A failed request resolves to an empty list: the rest of the home screen must
/// still render when the catalogue is unreachable.
final homeCategoriesProvider = FutureProvider<List<ServiceCategory>>((ref) async {
  try {
    return await ref.watch(salonsApiProvider).getCategories();
  } catch (_) {
    return const <ServiceCategory>[];
  }
});

/// Selected category slug (null = all categories).
class HomeCategoryController extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String? slug) => state = slug;
}

final selectedCategoryProvider =
    NotifierProvider<HomeCategoryController, String?>(HomeCategoryController.new);

/// Salons around [locationProvider], nearest first, optionally filtered
/// by [selectedCategoryProvider].
final nearbySalonsProvider = FutureProvider<List<SalonSummary>>((ref) async {
  final location = ref.watch(locationProvider);
  final categorySlug = ref.watch(selectedCategoryProvider);

  try {
    return await ref.watch(salonsApiProvider).getSalons(
          lat: location.lat,
          lng: location.lng,
          categorySlug: categorySlug?.isNotEmpty == true ? categorySlug : null,
          sort: 'distance',
        );
  } catch (_) {
    return const <SalonSummary>[];
  }
});

/// Active filter chip label, e.g. `همه`.
class HomeFilterController extends Notifier<String> {
  @override
  String build() => homeFilterLabels.first;

  void select(String label) => state = label;
}

final homeFilterProvider = NotifierProvider<HomeFilterController, String>(HomeFilterController.new);

/// ADR-011: the «خدمات سیار» toggle above the feed. Independent of
/// [homeFilterProvider] on purpose: that one is single-select («نزدیک من» and
/// «باز الان» cannot both hold), whereas mobile is a boolean the customer
/// combines with whichever chip is active.
class HomeMobileFilterController extends Notifier<bool> {
  @override
  bool build() => false;

  void toggle() => state = !state;

  void select(bool value) => state = value;
}

final homeMobileFilterProvider =
    NotifierProvider<HomeMobileFilterController, bool>(HomeMobileFilterController.new);

/// Locally toggled favourites. Kept in memory only; no endpoint yet.
class FavoriteSalonsController extends Notifier<Set<String>> {
  @override
  Set<String> build() => const <String>{};

  void toggle(String salonId) {
    state = state.contains(salonId)
        ? ({...state}..remove(salonId))
        : {...state, salonId};
  }
}

final favoriteSalonsProvider =
    NotifierProvider<FavoriteSalonsController, Set<String>>(FavoriteSalonsController.new);
