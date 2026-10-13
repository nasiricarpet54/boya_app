import 'package:customer_app/features/home/application/home_providers.dart';
import 'package:customer_app/features/location/application/city_provider.dart';
import 'package:customer_app/features/location/data/city_storage.dart';
import 'package:customer_app/features/location/data/geolocation_service.dart';
import 'package:customer_app/features/location/data/locations_api.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

/// The device and the network are both kept out of these tests:
///
/// - `geolocationServiceProvider` is overridden with a fake whose fix is
///   scripted per case, because a permission dialog cannot run in a unit test;
/// - `locationsApiProvider` is overridden with an offline API whose
///   reverse-geocode answer is also scripted, so the outcome of `resolve()` is
///   the only thing under test.
///
/// This mirrors the adapter pattern in `city_picker_test.dart` rather than
/// pulling in a mocking framework, per the app's dependency choices.

/// A scripted GPS fix, or `null` for "permission refused / GPS off".
class _FakeGeolocation extends GeolocationService {
  _FakeGeolocation(this._position);

  final Position? _position;

  @override
  Future<Position?> getCurrentPosition() async => _position;
}

/// Reverse-geocodes to a scripted result so each outcome can be exercised
/// without a Neshan key or a network.
class _OfflineLocationsApi extends LocationsApi {
  _OfflineLocationsApi(this._geocode) : super(Dio());

  final ReverseGeocodeResult? _geocode;

  @override
  Future<List<Province>> getProvinces() async => const <Province>[];

  @override
  Future<List<City>> getCities(String provinceId) async => const <City>[];

  @override
  Future<ReverseGeocodeResult?> reverseGeocode(double lat, double lng) async =>
      _geocode;
}

const _tehranProvince = Province(
  id: 'p1',
  code: 'THR',
  nameFa: 'تهران',
  nameEn: 'Tehran',
);

const _tehranCity = City(
  id: 'c1',
  provinceId: 'p1',
  code: 'THR-TEH',
  nameFa: 'تهران',
  nameEn: 'Tehran',
  isCapital: true,
);

Position _fix({double lat = 35.6892, double lng = 51.3890}) => Position(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.utc(2026, 10, 13),
      accuracy: 50,
      altitude: 1200,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

ProviderContainer _container({
  required Position? position,
  ReverseGeocodeResult? geocode,
  CityStorage? storage,
}) =>
    ProviderContainer(overrides: [
      geolocationServiceProvider.overrideWith((ref) => _FakeGeolocation(position)),
      locationsApiProvider.overrideWith((ref) => _OfflineLocationsApi(geocode)),
      cityStorageProvider.overrideWith((ref) => storage ?? InMemoryCityStorage()),
    ]);


void main() {
  group('locationProvider', () {
    test('falls back to the Tehran reference point before any fix', () {
      final container = _container(position: null);

      final location = container.read(locationProvider);

      expect(location.lat, 35.7575);
      expect(location.lng, 51.4100);
    });

    test('uses the device once it has been resolved', () async {
      final container = _container(position: _fix(lat: 35.6892, lng: 51.3890));

      await container.read(userLocationProvider.notifier).resolve();
      final location = container.read(locationProvider);

      expect(location.lat, 35.6892);
      expect(location.lng, 51.3890);
    });

    test('returns to the reference point when the fix is cleared', () async {
      final container = _container(position: _fix());

      await container.read(userLocationProvider.notifier).resolve();
      container.read(userLocationProvider.notifier).clear();
      final location = container.read(locationProvider);

      expect(location.lat, 35.7575);
    });
  });

  group('UserLocationController.resolve', () {
    test('selects the city the geocoder matched', () async {
      final container = _container(
        position: _fix(),
        geocode: const ReverseGeocodeResult(
          cityName: 'تهران',
          province: _tehranProvince,
          city: _tehranCity,
        ),
      );

      final outcome = await container.read(userLocationProvider.notifier).resolve();

      expect(outcome, UserLocationOutcome.resolved);
      // The resolved city is written to cityProvider, which is what narrows the
      // feed and labels the top bar — the picker does not have to be opened.
      expect(container.read(cityProvider).cityId, 'c1');
      expect(container.read(cityProvider).cityName, 'تهران');
    });

    test('reports positionUnavailable when GPS is refused or off', () async {
      final container = _container(position: null);

      final outcome = await container.read(userLocationProvider.notifier).resolve();

      expect(outcome, UserLocationOutcome.positionUnavailable);
      // No fix, so nothing was selected and the feed keeps its default centre.
      expect(container.read(cityProvider).hasCity, isFalse);
      expect(container.read(userLocationProvider), isNull);
    });

    test('reports cityNotServed when the catalogue has no matching city', () async {
      final container = _container(
        position: _fix(),
        // Neshan named a place the seed does not carry.
        geocode: const ReverseGeocodeResult(cityName: 'کهنوج'),
      );

      final outcome = await container.read(userLocationProvider.notifier).resolve();

      expect(outcome, UserLocationOutcome.cityNotServed);
      expect(container.read(cityProvider).hasCity, isFalse);
      // The coordinates still landed, so the feed can sort by distance even
      // though no city was selected.
      expect(container.read(userLocationProvider), isNotNull);
    });

    test('reports geocoderUnavailable when the backend has no Neshan key', () async {
      final container = _container(position: _fix(), geocode: null);

      final outcome = await container.read(userLocationProvider.notifier).resolve();

      expect(outcome, UserLocationOutcome.geocoderUnavailable);
      expect(container.read(cityProvider).hasCity, isFalse);
    });
  });
}
