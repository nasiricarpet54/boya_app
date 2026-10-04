import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/booking_record.dart';

class BookingHistoryApi {
  BookingHistoryApi(this._dio);

  final Dio _dio;

  Future<List<BookingRecord>> list() async {
    // GET /bookings answers with a `{ data: [...] }` envelope.
    final response = await _dio.get<Map<String, dynamic>>('/bookings');
    final rows = response.data?['data'];
    return [
      for (final item in (rows as List? ?? const <dynamic>[]))
        if (item is Map<String, dynamic>) BookingRecord.fromJson(item),
    ];
  }
}

final bookingHistoryApiProvider = Provider<BookingHistoryApi>(
  (ref) => BookingHistoryApi(ref.watch(dioProvider)),
);

final bookingsProvider = FutureProvider.family<List<BookingRecord>, String>((ref, status) async {
  final rows = await ref.watch(bookingHistoryApiProvider).list();
  return [for (final row in rows) if ((status == 'active') == row.isActive) row];
});
