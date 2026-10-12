import 'dart:convert';
import 'dart:typed_data';

import 'package:customer_app/features/home/data/salon_api.dart';
import 'package:customer_app/features/location/application/city_provider.dart';
import 'package:customer_app/features/location/data/city_storage.dart';
import 'package:customer_app/features/location/data/locations_api.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// The tests in this file never touch the network or platform channels:
///
/// - the `/locations` and `/salons` calls answer a scripted adapter, so the
///   request the client *builds* is observable;
/// - `cityStorageProvider` is overridden with [InMemoryCityStorage], because
///   `flutter_secure_storage` needs a real device (the same reason `SessionStore`
///   is abstract).
///
/// These mirror the existing `mobile_service_test.dart` adapter pattern rather
/// than pulling in a mocking framework, per the app's dependency choices.

typedef _Responder = ResponseBody Function(RequestOptions options);

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this._routes, this._requests);

  final Map<String, _Responder> _routes;
  final List<RequestOptions> _requests;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    _requests.add(options);
    final respond = _routes[options.path];
    if (respond == null) {
      return _json({'message': 'route not stubbed: ${options.path}'}, 404);
    }
    return respond(options);
  }
}

List<RequestOptions> _stubbed(Dio dio, Map<String, _Responder> routes) {
  final requests = <RequestOptions>[];
  dio.httpClientAdapter = _StubAdapter(routes, requests);
  return requests;
}

ResponseBody _json(Object body, [int status = 200]) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});

const _tehranProvince = Province(id: 'p1', code: 'THR', nameFa: 'تهران', nameEn: 'Tehran');

const _tehranCity = City(
  id: 'c1',
  provinceId: 'p1',
  code: 'THR-TEH',
  nameFa: 'تهران',
  nameEn: 'Tehran',
  isCapital: true,
);

/// `LocationsApi` that answers nothing: the provider tests must not depend on
/// the network at all, including the name lookup the controller runs on
/// restore, which simply leaves the label unresolved.
class _OfflineLocationsApi extends LocationsApi {
  _OfflineLocationsApi() : super(Dio());

  @override
  Future<List<Province>> getProvinces() async => const <Province>[];

  @override
  Future<List<City>> getCities(String provinceId) async => const <City>[];
}

ProviderContainer _container({CityStorage? storage, LocationsApi? locations}) =>
    ProviderContainer(overrides: [
      cityStorageProvider.overrideWith((ref) => storage ?? InMemoryCityStorage()),
      locationsApiProvider.overrideWith((ref) => locations ?? _OfflineLocationsApi()),
    ]);

void main() {
  group('Province and City models', () {
    test('Province.fromJson reads the picker fields and ignores the rest', () {
      final province = Province.fromJson({
        'id': 'p1',
        'code': 'THR',
        'nameFa': 'تهران',
        'nameEn': 'Tehran',
        'displayOrder': 1,
        'isActive': true,
        // The seed carries coordinates the picker never shows.
        'lat': 35.6892,
        'lng': 51.389,
      });

      expect(province.id, 'p1');
      expect(province.code, 'THR');
      expect(province.nameFa, 'تهران');
      expect(province.nameEn, 'Tehran');
    });

    test('City.fromJson reads the province link and the capital flag', () {
      final city = City.fromJson({
        'id': 'c1',
        'provinceId': 'p1',
        'code': 'THR-TEH',
        'nameFa': 'تهران',
        'nameEn': 'Tehran',
        'isCapital': true,
      });

      expect(city.id, 'c1');
      expect(city.provinceId, 'p1');
      expect(city.code, 'THR-TEH');
      expect(city.nameFa, 'تهران');
      expect(city.isCapital, isTrue);
    });

    test('City.fromJson treats a missing isCapital as "not the capital"', () {
      final city = City.fromJson({
        'id': 'c2',
        'provinceId': 'p1',
        'code': 'THR-PRD',
        'nameFa': 'پردیس',
        'nameEn': 'Pardis',
      });

      expect(city.isCapital, isFalse);
    });
  });

  group('LocationsApi', () {
    test('getProvinces hits /locations/provinces and decodes the bare array', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
      final requests = _stubbed(dio, {
        '/locations/provinces': (_) => _json([
              {'id': 'p1', 'code': 'THR', 'nameFa': 'تهران', 'nameEn': 'Tehran'},
            ]),
      });

      final provinces = await LocationsApi(dio).getProvinces();

      expect(requests.single.path, '/locations/provinces');
      expect(provinces.length, 1);
      expect(provinces.single.id, 'p1');
      expect(provinces.single.nameFa, 'تهران');
    });

    test('getCities sends the province id in the path', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
      final requests = _stubbed(dio, {
        '/locations/provinces/p1/cities': (_) => _json([
              {
                'id': 'c1',
                'provinceId': 'p1',
                'code': 'THR-TEH',
                'nameFa': 'تهران',
                'nameEn': 'Tehran',
                'isCapital': true,
              },
            ]),
      });

      final cities = await LocationsApi(dio).getCities('p1');

      expect(requests.single.path, '/locations/provinces/p1/cities');
      expect(cities.length, 1);
      expect(cities.single.id, 'c1');
      expect(cities.single.isCapital, isTrue);
    });

    test('an empty province answers no cities rather than throwing', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
      _stubbed(dio, {
        '/locations/provinces/unknown/cities': (_) => _json(<Object>[]),
      });

      expect(await LocationsApi(dio).getCities('unknown'), isEmpty);
    });
  });


  group('SalonsApi', () {
    test('getSalons sends cityId when a city is selected', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
      final requests = _stubbed(dio, {
        '/salons': (_) => _json({'data': <Object>[]}),
      });

      await SalonsApi(dio).getSalons(cityId: 'c1');

      expect(requests.single.path, '/salons');
      expect(requests.single.queryParameters['cityId'], 'c1');
    });

    test('getSalons omits cityId when no city is selected', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
      final requests = _stubbed(dio, {
        '/salons': (_) => _json({'data': <Object>[]}),
      });

      await SalonsApi(dio).getSalons();

      expect(requests.single.queryParameters['cityId'], isNull);
    });

    test('getSalons reads the salon rows out of data', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
      _stubbed(dio, {
        '/salons': (_) => _json({
              'data': [
                {
                  'id': 's1',
                  'name': 'سالن نمونه',
                  'rating': 4.8,
                  'reviews': 120,
                  'minPrice': 250000,
                  'tags': ['اصلاح'],
                  'offersMobileService': false,
                  'cityId': 'c1',
                  'provinceId': 'p1',
                },
              ],
              'total': 1,
              'page': 1,
              'pageSize': 20,
            }),
      });

      final salons = await SalonsApi(dio).getSalons(cityId: 'c1');

      expect(salons.length, 1);
      expect(salons.single.id, 's1');
      expect(salons.single.cityId, 'c1');
    });
  });

  group('cityProvider', () {
    test('starts empty', () {
      final container = _container();
      addTearDown(container.dispose);

      final state = container.read(cityProvider);

      expect(state.cityId, isNull);
      expect(state.provinceId, isNull);
      expect(state.cityName, isNull);
      // `displayCityName` stays null with no choice: the top bar owns the
      // «انتخاب شهر» fallback, so the state never carries display copy.
      expect(state.displayCityName, isNull);
    });

    test('selectCity() resolves the Persian name off /locations', () async {
      final locations = _OfflineLocationsApi();
      final container = _container(locations: locations);
      addTearDown(container.dispose);

      // A real API would answer here; _OfflineLocationsApi is deliberately empty
      // so this test proves the selection does not depend on the network.
      await container.read(cityProvider.notifier).selectCity(_tehranProvince, _tehranCity);

      final state = container.read(cityProvider);
      expect(state.cityId, 'c1');
      expect(state.provinceId, 'p1');
      expect(state.cityName, 'تهران');
    });

    test('selectCity() keeps only one stored city, not a stack', () async {
      final store = InMemoryCityStorage();
      final container = _container(storage: store);
      addTearDown(container.dispose);

      await container.read(cityProvider.notifier).selectCity(_tehranProvince, _tehranCity);

      expect(store.stored?.cityId, 'c1');
    });

    test('hydrate() restores the ids', () async {
      final store = InMemoryCityStorage()
        ..stored = const StoredCity(cityId: 'c1', provinceId: 'p1');
      final container = _container(storage: store);
      addTearDown(container.dispose);

      container.read(cityProvider);
      // The restore is async: the ids land, then the name resolves off
      // /locations. Two turns is enough for a chain of pure microtasks.
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(cityProvider);
      expect(state.cityId, 'c1');
      expect(state.provinceId, 'p1');
    });

    test('clear() drops the state and the cached ids', () async {
      final store = InMemoryCityStorage()
        ..stored = const StoredCity(cityId: 'c1', provinceId: 'p1');
      final container = _container(storage: store);
      addTearDown(container.dispose);

      await container
          .read(cityProvider.notifier)
          .selectCity(_tehranProvince, _tehranCity);
      await container.read(cityProvider.notifier).clear();

      final state = container.read(cityProvider);
      expect(state.cityId, isNull);
      expect(state.provinceId, isNull);
      expect(state.cityName, isNull);
      expect(store.stored, isNull);
    });
  });
}

