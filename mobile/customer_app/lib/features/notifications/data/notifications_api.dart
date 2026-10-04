import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/notification_item.dart';

/// How often the bell badge re-reads the unread count. A minute is short enough
/// that a reminder lands while the customer is still on the home screen, and
/// long enough not to keep a request running on every tab.
const Duration notificationPollInterval = Duration(seconds: 60);

/// One page of notifications plus the server's own unread count, so the badge
/// does not need a second round trip to agree with the list.
class NotificationPage {
  const NotificationPage({required this.items, required this.unreadCount});

  final List<NotificationItem> items;
  final int unreadCount;
}

class NotificationsApi {
  NotificationsApi(this._dio);

  final Dio _dio;

  Future<NotificationPage> listNotifications({int page = 1}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/notifications',
      queryParameters: {'page': page},
    );
    final body = response.data ?? const <String, dynamic>{};
    final rows = body['data'];
    final unread = body['unreadCount'];
    return NotificationPage(
      items: [
        for (final item in (rows as List? ?? const <dynamic>[]))
          if (item is Map<String, dynamic>) NotificationItem.fromJson(item),
      ],
      unreadCount: unread is num ? unread.toInt() : 0,
    );
  }

  Future<int> unreadCount() async {
    final response = await _dio.get<Map<String, dynamic>>('/notifications/unread-count');
    final count = response.data?['count'];
    return count is num ? count.toInt() : 0;
  }

  Future<void> markRead(String id) => _dio.patch<void>('/notifications/$id/read');

  Future<void> markAllRead() => _dio.patch<void>('/notifications/read-all');
}

final notificationsApiProvider = Provider<NotificationsApi>(
  (ref) => NotificationsApi(ref.watch(dioProvider)),
);

/// The list behind the notification screen. Invalidated on pull-to-refresh and
/// after a mark-read, which is what keeps the unread dot and the badge honest.
final notificationsListProvider = FutureProvider<NotificationPage>(
  (ref) => ref.watch(notificationsApiProvider).listNotifications(),
);

/// Unread count for the bell. Polls every [notificationPollInterval] so a
/// reminder created by the cron shows up without a manual pull.
///
/// Failures resolve to 0 rather than an error state: the badge is decoration on
/// top of a screen that still works, and an unreachable API must not put a red
/// error card where the bell belongs. Marking a notification read invalidates
/// this provider, which restarts the stream and re-reads the count at once.
///
/// The poll is built on `Stream.periodic` rather than a bare `Future.delayed`
/// loop: cancelling the subscription cancels the underlying timer with it, so
/// disposing the bell never leaves a minute-long timer behind.
final unreadCountProvider = StreamProvider<int>((ref) async* {
  final api = ref.watch(notificationsApiProvider);
  yield await _readUnread(api);
  yield* Stream<int>.periodic(notificationPollInterval).asyncMap((_) => _readUnread(api));
});

Future<int> _readUnread(NotificationsApi api) async {
  try {
    return await api.unreadCount();
  } catch (_) {
    return 0;
  }
}