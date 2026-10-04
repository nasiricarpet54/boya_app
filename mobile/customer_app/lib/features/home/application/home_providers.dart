import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/salon_api.dart';
import '../domain/salon_summary.dart';
import '../domain/service_category.dart';

class _City {
  const _City(this.name, this.slug);
  final String name;
  final String slug;
}

/// Cities offered by the top-bar picker until the location API lands.
const homeCities = [
  _City('تهران', 'tehran'),
  _City('کرج', 'karaj'),
  _City('اصفهان', 'esfahan'),
  _City('مشهد', 'mashhad'),
  _City('شیراز', 'shiraz'),
  _City('تبریز', 'tabriz'),
  _City('قم', 'qom'),
  _City('اهواز', 'ahvaz'),
  _City('کرمانشاه', 'kermanshah'),
  _City('ارومیه', 'orumiyeh'),
  _City('رشت', 'resht'),
  _City('زاهدان', 'zahedan'),
  _City('کرمان', 'kerman'),
  _City('همدان', 'hamedan'),
  _City('یزد', 'yazd'),
  _City('اردبیل', 'ardabil'),
  _City('بندرعباس', 'bandar_abbas'),
  _City('اراک', 'araq'),
  _City('قزوین', 'qazvin'),
  _City('ساری', 'sari'),
  _City('گرگان', 'gorgan'),
  _City('بوشهر', 'bushehr'),
  _City('خرم‌آباد', 'khorramabad'),
  _City('سنندج', 'sanandaj'),
  _City('بیرجند', 'birjand'),
  _City('بجنورد', 'bojnoord'),
  _City('ایلام', 'ilam'),
  _City('شهرکرد', 'shahrekord'),
  _City('یاسوج', 'yasuj'),
  _City('سمنان', 'semnan'),
  _City('زنجان', 'zanjan'),
];

/// Default city per the current requirement.
const defaultHomeCity = 'تهران';

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

/// Selected city shown in the top bar.
class HomeCityController extends Notifier<String> {
  @override
  String build() => defaultHomeCity;

  void select(String city) => state = city;
}

final homeCityProvider = NotifierProvider<HomeCityController, String>(HomeCityController.new);

/// Active filter chip label, e.g. `همه`.
class HomeFilterController extends Notifier<String> {
  @override
  String build() => homeFilterLabels.first;

  void select(String label) => state = label;
}

final homeFilterProvider = NotifierProvider<HomeFilterController, String>(HomeFilterController.new);

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
