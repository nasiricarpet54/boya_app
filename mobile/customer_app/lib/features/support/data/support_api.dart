import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'support_ticket.dart';

/// `POST /support/tickets` and `GET /support/tickets`.
///
/// The list endpoint answers a `{ "data": [] }` envelope like `/bookings`, and
/// `create` answers the bare row with `201`. Both surface failures by throwing
/// — the screens already render `messageFromDio` and a retry, so there is
/// nothing to swallow here.
class SupportApi {
  SupportApi(this._dio);

  final Dio _dio;

  /// Files a new ticket. Returns the created row so the caller can show the
  /// server-assigned id and status immediately.
  Future<SupportTicket> createTicket({
    required String type,
    required String subject,
    required String message,
    String? bookingId,
    String? salonId,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/support/tickets',
      data: <String, dynamic>{
        'type': type,
        'subject': subject,
        'message': message,
        // The backend stores `undefined` as the column default; sending `null`
        // keeps "no context attached" explicit and tri-state.
        if (bookingId != null) 'bookingId': bookingId,
        if (salonId != null) 'salonId': salonId,
      },
    );
    final json = response.data;
    if (json is! Map<String, dynamic>) {
      throw DioException(
        requestOptions: response.requestOptions,
        message: '���� ���� ������� ���',
      );
    }
    return SupportTicket.fromJson(json);
  }

  /// Every ticket of the signed-in user, newest first. The server scopes the
  /// query by the token, so nothing client-side can widen it.
  Future<List<SupportTicket>> listMine() async {
    final response = await _dio.get<Map<String, dynamic>>('/support/tickets');
    final rows = response.data?['data'];
    return <SupportTicket>[
      for (final item in (rows as List? ?? const <dynamic>[]))
        if (item is Map<String, dynamic>) SupportTicket.fromJson(item),
    ];
  }
}

final supportApiProvider = Provider<SupportApi>(
  (ref) => SupportApi(ref.watch(dioProvider)),
);

/// The customer's ticket history, newest first. Invalidated by the create screen
/// after a successful submit so the list re-fetches on return.
final myTicketsProvider = FutureProvider<List<SupportTicket>>(
  (ref) async => ref.watch(supportApiProvider).listMine(),
);
