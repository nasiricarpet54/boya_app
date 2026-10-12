import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/city_storage.dart';
import '../data/locations_api.dart';

/// The city the home feed is scoped to.
///
/// Every field is optional: with no choice the feed falls back to the whole
/// catalogue and the top bar shows «انتخاب شهر».
class LocationState {
  const LocationState({this.provinceId, this.cityId, this.cityName});

  /// `cities.id` of the chosen city, `null` until the customer picks one.
  final String? provinceId;

  final String? cityId;

  /// Persian name for the top bar and the salon cards. The picker sets it from
  /// the [City] it already has in hand; on a cold start it is filled in a tick
  /// later, once `/locations` has resolved the cached ids back to a name.
  final String? cityName;

  bool get hasCity => cityId != null && cityId!.isNotEmpty;

  /// What the top bar shows: the city's name, or `null` while it is still being
  /// resolved so the caller can fall back to the «انتخاب شهر» prompt.
  String? get displayCityName =>
      (cityName != null && cityName!.isNotEmpty) ? cityName : null;

  LocationState copyWith({
    String? provinceId,
    String? cityId,
    String? cityName,
  }) =>
      LocationState(
        provinceId: provinceId ?? this.provinceId,
        cityId: cityId ?? this.cityId,
        cityName: cityName ?? this.cityName,
      );

  @override
  String toString() =>
      'LocationState(provinceId: $provinceId, cityId: $cityId, cityName: $cityName)';
}

/// The selected city, kept in sync with the keystore so the feed reopens on the
/// same city.
///
/// On start the cached ids come back from [CityStorage] and the Persian name is
/// re-resolved from `/locations`. The ids land first — the feed is what has to
/// be city-filtered — and the label follows a moment later.
class LocationController extends Notifier<LocationState> {
  @override
  LocationState build() {
    _restore();
    return const LocationState();
  }

  /// Reads the cached selection back. A failure to reach the keystore means
  /// "no city chosen": the feed still works, it just is not filtered.
  Future<void> _restore() async {
    final StoredCity? stored;
    try {
      stored = await ref.read(cityStorageProvider).read();
    } catch (_) {
      return;
    }
    if (stored == null || stored.cityId == null) return;

    state = LocationState(provinceId: stored.provinceId, cityId: stored.cityId);
    await _resolveCityName(stored.provinceId, stored.cityId!);
  }

  /// Looks up the Persian name of the restored city so the top bar can show it.
  /// The province list is not needed — the cached province id selects the city
  /// list directly. A failure leaves the ids in place: the feed is still
  /// filtered correctly, only the label is missing until the next restore.
  Future<void> _resolveCityName(String? provinceId, String cityId) async {
    if (provinceId == null || provinceId.isEmpty) return;
    try {
      final cities = await ref.read(locationsApiProvider).getCities(provinceId);
      for (final city in cities) {
        if (city.id == cityId) {
          state = state.copyWith(cityName: city.nameFa);
          return;
        }
      }
    } catch (_) {
      // Offline on launch: the ids still filter the feed, the name resolves on
      // a later start or shows the fallback label meanwhile.
    }
  }

  /// Remembers the choice and updates the state. The home feed watches the
  /// state, so this is also what re-fetches the salon list.
  Future<void> selectCity(Province province, City city) async {
    state = LocationState(
      provinceId: province.id,
      cityId: city.id,
      cityName: city.nameFa,
    );
    await ref.read(cityStorageProvider).write(city.id, province.id);
  }

  /// Forgets the choice: the feed goes back to the whole catalogue.
  Future<void> clear() async {
    await ref.read(cityStorageProvider).clear();
    state = const LocationState();
  }
}

final cityProvider =
    NotifierProvider<LocationController, LocationState>(LocationController.new);
