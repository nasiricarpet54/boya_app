import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../location/application/city_provider.dart';
import '../../location/data/geolocation_service.dart';
import '../../location/data/locations_api.dart';
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

/// The device's own GPS fix, resolved on demand.
///
/// `null` until the customer asks for it (the «موقعیت من» tile or the
/// «نزدیک من» chip): the app does not prompt for location on launch, because a
/// cold-start permission request is the fastest way to lose a customer who
/// only wanted to browse.
///
/// Every failure leaves this `null` — [GeolocationService] already converts a
/// refused permission, disabled GPS or a timeout into `null`, and the callers
/// own the user-facing copy. A resolved city is written straight to
/// [cityProvider] so the feed narrows to it and the top bar shows its name.
class UserLocationController extends Notifier<UserLocation?> {
  @override
  UserLocation? build() => null;

  /// Walks GPS → reverse-geocode → the selected city.
  ///
  /// Returns the outcome so the caller can say precisely what happened instead
  /// of a generic error: a refused permission, a city the catalogue does not
  /// carry, or a backend without a Neshan key are three different messages.
  Future<UserLocationOutcome> resolve() async {
    final position = await ref.read(geolocationServiceProvider).getCurrentPosition();
    if (position == null) return UserLocationOutcome.positionUnavailable;

    final resolved = UserLocation(lat: position.latitude, lng: position.longitude);
    state = resolved;

    final result = await ref.read(locationsApiProvider).reverseGeocode(
          position.latitude,
          position.longitude,
        );
    // 503 — the deployment has no Neshan key. A deployment gap, not something
    // retrying helps, so the coordinates stay and the caller reports it as
    // "unavailable" rather than as a network failure.
    if (result == null) return UserLocationOutcome.geocoderUnavailable;

    if (!result.hasResolvedCity) {
      return UserLocationOutcome.cityNotServed;
    }

    await ref.read(cityProvider.notifier).selectCity(result.province!, result.city!);
    return UserLocationOutcome.resolved;
  }

  /// Drops the fix so the feed falls back to the default reference point.
  void clear() => state = null;
}

final userLocationProvider =
    NotifierProvider<UserLocationController, UserLocation?>(UserLocationController.new);

/// What happened when the customer asked for their location, so the UI can say
/// it in one Persian sentence instead of showing a generic error.
enum UserLocationOutcome {
  /// GPS returned a city the picker then selected.
  resolved,

  /// Permission refused, GPS off, or no fix in time.
  positionUnavailable,

  /// The device reported a place the city catalogue does not carry yet.
  cityNotServed,

  /// Reverse-geocoding is not configured on the server (no Neshan key).
  geocoderUnavailable,
}

/// One resolved device position.
class UserLocation {
  const UserLocation({required this.lat, required this.lng});

  final double lat;
  final double lng;
}

/// Centre point the "near me" feed is measured from.
///
/// The customer's own fix when they have shared one ([userLocationProvider]),
/// otherwise Tehran's city centre as a sensible national default — the API only
/// needs a reference point to fill in `distanceKm`.
class HomeLocation {
  const HomeLocation({required this.lat, required this.lng});

  final double lat;
  final double lng;
}

final locationProvider = Provider<HomeLocation>((ref) {
  final user = ref.watch(userLocationProvider);
  if (user != null) return HomeLocation(lat: user.lat, lng: user.lng);
  return const HomeLocation(lat: 35.7575, lng: 51.4100);
});

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
/// by [selectedCategoryProvider] and by the «باز الان» (Open Now) chip.
final nearbySalonsProvider = FutureProvider<List<SalonSummary>>((ref) async {
  final location = ref.watch(locationProvider);
  final categorySlug = ref.watch(selectedCategoryProvider);
  final openNowOnly = ref.watch(homeOpenNowFilterProvider);

  try {
    final salons = await ref.watch(salonsApiProvider).getSalons(
          lat: location.lat,
          lng: location.lng,
          categorySlug: categorySlug?.isNotEmpty == true ? categorySlug : null,
          sort: 'distance',
        );
    if (openNowOnly) {
      return salons.where((salon) => salon.isOpenNow).toList();
    }
    return salons;
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

/// Whether the «باز الان» (Open Now) chip is the active one.
///
/// Derived from [homeFilterProvider] so the chip and the feed can never drift
/// apart: the single source of truth stays the selected label.
final homeOpenNowFilterProvider = Provider<bool>((ref) {
  return ref.watch(homeFilterProvider) == 'باز الان';
});

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

/// Same-day acceptance filter. When true, only salons that are open now are shown.
class HomeSameDayFilterController extends Notifier<bool> {
  @override
  bool build() => false;

  void toggle() => state = !state;

  void select(bool value) => state = value;
}

final homeSameDayFilterProvider =
    NotifierProvider<HomeSameDayFilterController, bool>(HomeSameDayFilterController.new);

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
