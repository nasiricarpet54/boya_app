import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/available_slot.dart';
import '../domain/salon_detail.dart';

class SalonApi {
  SalonApi(this._dio);

  final Dio _dio;

  Future<SalonDetail> fetch(String salonId) async {
    final response = await _dio.get('/salons/$salonId');
    final data = response.data as Map<String, dynamic>;
    return SalonDetail.fromJson(data);
  }

  /// Bookable times of a salon for one day and one service.
  ///
  /// [date] is the Gregorian civil day the customer picked; the query string
  /// carries it as `YYYY-MM-DD`. Slots come back as `HH:MM` Tehran wall-clock
  /// labels. When [specialistId] is given only that specialist's bookings
  /// count against a slot.
  Future<List<AvailableSlot>> getAvailableSlots({
    required String salonId,
    required DateTime date,
    required String serviceId,
    String? specialistId,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/salons/$salonId/available-slots',
      queryParameters: {
        'date': _isoDate(date),
        'serviceId': serviceId,
        'specialistId': ?specialistId,
      },
    );
    final rows = response.data?['data'];
    return [
      for (final item in (rows as List? ?? const <dynamic>[]))
        if (item is Map<String, dynamic>) AvailableSlot.fromJson(item),
    ];
  }

  /// Every portfolio photo of every active specialist of a salon.
  ///
  /// Public, like the rest of the salon endpoints: the gallery shows before the
  /// customer signs in. A salon with no photos returns an empty list.
  Future<List<PortfolioItem>> getPortfolio(String salonId) async {
    final response = await _dio.get<Map<String, dynamic>>('/salons/$salonId/portfolio');
    final rows = response.data?['data'];
    return [
      for (final item in (rows as List? ?? const <dynamic>[]))
        if (item is Map<String, dynamic>) PortfolioItem.fromJson(item),
    ];
  }
}

final salonApiProvider = Provider<SalonApi>((ref) => SalonApi(ref.watch(dioProvider)));

final salonDetailProvider = FutureProvider.family<SalonDetail, String>((ref, salonId) {
  return ref.watch(salonApiProvider).fetch(salonId);
});

/// Portfolio photos of the salon's specialists, for the detail page's
/// «نمونه‌کارها» tab.
///
/// Derived from the `portfolio` field the detail endpoint already embeds, so
/// the tab costs no second request and stays consistent with the rest of the
/// page when the detail is refetched. Loading and error are carried over from
/// [salonDetailProvider] rather than invented here.
final salonPortfolioProvider = FutureProvider.family<List<PortfolioItem>, String>(
  (ref, salonId) => ref.watch(salonDetailProvider(salonId)).map(
        data: (detail) => detail.value.portfolio,
        error: (error) {
          // Surfaced by the tab through `when(error:)`; rethrow so a caller
          // holding the Future sees the same exception the detail reports.
          throw error.error;
        },
        loading: (state) => const <PortfolioItem>[],
      ),
);

/// Key of [availableSlotsProvider]; the date is normalized to its civil day so
/// the provider only refetches when the day itself changes.
typedef AvailableSlotsQuery = ({String salonId, DateTime date, String serviceId, String? specialistId});

/// Re-fetched whenever the picked date, service or specialist changes.
final availableSlotsProvider =
    FutureProvider.autoDispose.family<List<AvailableSlot>, AvailableSlotsQuery>((ref, query) {
  return ref.watch(salonApiProvider).getAvailableSlots(
        salonId: query.salonId,
        date: query.date,
        serviceId: query.serviceId,
        specialistId: query.specialistId,
      );
});

/// `YYYY-MM-DD` of a civil day, the format `available-slots` expects.
String _isoDate(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}
