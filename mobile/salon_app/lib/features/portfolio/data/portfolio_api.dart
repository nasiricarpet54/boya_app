import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../services/data/services_api.dart';
import '../domain/portfolio_item.dart';

/// CRUD for the salon panel's portfolio (نمونه‌کارها). Token-protected, so
/// the interceptor attaches the bearer header; the tenant comes from the JWT
/// on the backend, never from these payloads.
///
/// Add and delete both flip the salon to `pending_approval` — the gallery is
/// part of the public profile — so the write results come back with that
/// status and the caller should refresh [salonStatusProvider] too.
class PortfolioApi {
  PortfolioApi(this._dio);

  final Dio _dio;

  /// Every portfolio photo of every specialist of the salon, inactive
  /// specialists included — the panel manages them too.
  Future<List<PortfolioItem>> listPortfolio() async {
    final response = await _dio.get<Map<String, dynamic>>('/salon/me/portfolio');
    final data = response.data?['data'];
    return [
      if (data is List)
        for (final item in data)
          if (item is Map<String, dynamic>) PortfolioItem.fromJson(item),
    ];
  }

  /// Appends one photo to a specialist's gallery; tenant goes to
  /// `pending_approval`.
  Future<PanelWriteResult> addPortfolioItem({
    required String specialistId,
    required String imageUrl,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/salon/me/portfolio',
      data: <String, dynamic>{'specialistId': specialistId, 'imageUrl': imageUrl},
    );
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  /// Removes one photo by the id the listing hands out (either the
  /// element's own uuid or the position-derived key); tenant goes to
  /// `pending_approval`.
  Future<PanelWriteResult> deletePortfolioItem(String id) async {
    final response = await _dio.delete<Map<String, dynamic>>('/salon/me/portfolio/$id');
    return PanelWriteResult.fromJson(response.data ?? const {});
  }
}

final portfolioApiProvider = Provider<PortfolioApi>(
  (ref) => PortfolioApi(ref.watch(dioProvider)),
);

/// The salon's portfolio grid. Every write invalidates it.
final portfolioListProvider = FutureProvider<List<PortfolioItem>>(
  (ref) => ref.watch(portfolioApiProvider).listPortfolio(),
);
