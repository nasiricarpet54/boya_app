import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// An Iranian province, one item of `GET /locations/provinces`.
///
/// Reference data seeded by backend migration 1730000000039 — the same for every
/// customer and tenant-agnostic, so it is safe to hold in memory for the life of
/// the picker. Only the fields the picker shows are declared; lat/lng and
/// displayOrder are dropped on arrival.
class Province {
  const Province({
    required this.id,
    required this.code,
    required this.nameFa,
    required this.nameEn,
  });

  /// Parses one province row. Every field is optional the way the rest of the
  /// app's models are: a malformed catalogue entry must not crash the picker.
  factory Province.fromJson(Map<String, dynamic> json) => Province(
        id: (json['id'] as String?) ?? '',
        code: (json['code'] as String?) ?? '',
        nameFa: (json['nameFa'] as String?) ?? '',
        nameEn: (json['nameEn'] as String?) ?? '',
      );

  final String id;

  /// The stable human key, e.g. `THR`. Unique across the table.
  final String code;

  final String nameFa;
  final String nameEn;
}

/// A city belonging to one province, one item of
/// `GET /locations/provinces/:id/cities`.
class City {
  const City({
    required this.id,
    required this.provinceId,
    required this.code,
    required this.nameFa,
    required this.nameEn,
    required this.isCapital,
  });

  factory City.fromJson(Map<String, dynamic> json) => City(
        id: (json['id'] as String?) ?? '',
        provinceId: (json['provinceId'] as String?) ?? '',
        code: (json['code'] as String?) ?? '',
        nameFa: (json['nameFa'] as String?) ?? '',
        nameEn: (json['nameEn'] as String?) ?? '',
        isCapital: json['isCapital'] as bool? ?? false,
      );

  final String id;
  final String provinceId;

  /// Unique within the province, e.g. `THR-TEH`.
  final String code;

  final String nameFa;
  final String nameEn;

  /// The province's seat, listed first by every city picker.
  final bool isCapital;
}

/// Read-only client for the province/city reference data (`/locations`).
///
/// Both routes are `@Public` on the API: choosing a city is the first thing a
/// customer does, before there is a token to send, and the data is the same for
/// everyone. Unlike `/salons`, these endpoints answer a **bare array** rather
/// than a `{ "data": [] }` envelope, so the body is decoded as a list.
class LocationsApi {
  LocationsApi(this._dio);

  final Dio _dio;

  /// Every active province from `GET /locations/provinces`, display-order first
  /// — the order the city picker renders.
  Future<List<Province>> getProvinces() async {
    final response = await _dio.get<List<dynamic>>('/locations/provinces');
    final rows = response.data;
    if (rows == null) return const <Province>[];

    return <Province>[
      for (final row in rows)
        if (row is Map<String, dynamic>) Province.fromJson(row),
    ];
  }

  /// Every active city of one province from
  /// `GET /locations/provinces/:id/cities`, the capital first.
  ///
  /// An unknown province answers an empty list rather than throwing, so the
  /// picker simply shows nothing instead of an error banner.
  Future<List<City>> getCities(String provinceId) async {
    final response = await _dio.get<List<dynamic>>(
      '/locations/provinces/$provinceId/cities',
    );
    final rows = response.data;
    if (rows == null) return const <City>[];

    return <City>[
      for (final row in rows)
        if (row is Map<String, dynamic>) City.fromJson(row),
    ];
  }
}

final locationsApiProvider = Provider<LocationsApi>(
  (ref) => LocationsApi(ref.watch(dioProvider)),
);

/// The catalogue behind step one of the city picker. The data is stable for the
/// app's lifetime, so Riverpod's cache holds one request per process and the
/// picker re-opens instantly. A failure surfaces to the sheet, which renders a
/// retry rather than an empty list of provinces with no explanation.
final provincesProvider = FutureProvider<List<Province>>(
  (ref) async => ref.watch(locationsApiProvider).getProvinces(),
);

/// The cities of one province, keyed by province id so switching back and forth
/// between provinces in the picker never re-fetches a list already fetched.
final citiesProvider = FutureProvider.family<List<City>, String>(
  (ref, provinceId) async => ref.watch(locationsApiProvider).getCities(provinceId),
);
