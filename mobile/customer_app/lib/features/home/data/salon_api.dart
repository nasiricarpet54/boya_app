import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/salon_summary.dart';
import '../domain/service_category.dart';

/// Read-only client for the public salon catalogue.
///
/// No token is attached: these routes are public on the API, which is what lets
/// the home feed render before the customer has signed in.
class SalonsApi {
  SalonsApi(this._dio);

  final Dio _dio;

  /// One page of `GET /salons`.
  ///
  /// [radiusKm] is accepted for the planned "within X km" filter but is not sent
  /// yet: the endpoint rejects unknown query parameters, so sending it would
  /// turn every request into a 400.
  Future<List<SalonSummary>> getSalons({
    double? lat,
    double? lng,
    double? radiusKm,
    String? categorySlug,
    String? sort,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/salons',
      queryParameters: <String, dynamic>{
        'lat': ?lat,
        'lng': ?lng,
        if (categorySlug != null && categorySlug.isNotEmpty) 'category': categorySlug,
        if (sort != null && sort.isNotEmpty) 'sort': sort,
        'page': page,
        'limit': limit,
      },
    );

    final rows = response.data?['data'];
    if (rows is! List) return const <SalonSummary>[];

    return <SalonSummary>[
      for (final row in rows)
        if (row is Map<String, dynamic>) SalonSummary.fromJson(row),
    ];
  }

  /// Every active category of `GET /categories`, ordered by the API.
  Future<List<ServiceCategory>> getCategories() async {
    final response = await _dio.get<Map<String, dynamic>>('/categories');

    final rows = response.data?['data'];
    if (rows is! List) return const <ServiceCategory>[];

    return <ServiceCategory>[
      for (final row in rows)
        if (row is Map<String, dynamic>) ServiceCategory.fromJson(row),
    ];
  }

  /// One salon from `GET /salons/{id}`.
  Future<SalonSummary> getSalonById(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/salons/$id');
    final json = response.data;

    if (json is! Map<String, dynamic>) {
      throw StateError('پاسخ نامعتبر از سرویس سالن‌ها');
    }
    return SalonSummary.fromJson(json);
  }
}

final salonsApiProvider = Provider<SalonsApi>((ref) => SalonsApi(ref.watch(dioProvider)));
