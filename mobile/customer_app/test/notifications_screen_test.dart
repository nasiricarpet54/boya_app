import 'package:customer_app/features/notifications/data/notifications_api.dart';
import 'package:customer_app/features/notifications/domain/notification_item.dart';
import 'package:customer_app/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

NotificationItem _item({
  String type = 'booking_reminder',
  String title = 'یادآوری نوبت',
  String body = 'نوبت شما نزدیک است و توسط سالن تایید شده است.',
  bool isRead = false,
  // A little over five minutes, so the relative label truncates to ۵ rather
  // than to ۴ from the microseconds lost while the test builds the widget.
  Duration age = const Duration(minutes: 5, seconds: 30),
}) {
  return NotificationItem(
    id: 'n1',
    type: type,
    title: title,
    body: body,
    isRead: isRead,
    createdAt: DateTime.now().subtract(age),
  );
}

Future<void> _pump(WidgetTester tester, List<NotificationItem> items) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        notificationsListProvider.overrideWith(
          (ref) async => NotificationPage(
            items: items,
            unreadCount: items.where((item) => !item.isRead).length,
          ),
        ),
        // The badge polls; a single value keeps the test off the network and
        // leaves no timer behind.
        unreadCountProvider.overrideWith((ref) => Stream<int>.value(0)),
      ],
      child: const MaterialApp(home: NotificationsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('lists a notification with its relative age and unread dot', (tester) async {
    await _pump(tester, [_item()]);

    expect(find.text('اعلان‌ها'), findsOneWidget);
    expect(find.text('یادآوری نوبت'), findsOneWidget);
    expect(find.text('۵ دقیقه پیش'), findsOneWidget);
    // The unread cue: a filled dot in the row, not a badge.
    expect(find.byIcon(Icons.circle), findsOneWidget);
  });

  testWidgets('drops the unread dot once the row is read', (tester) async {
    await _pump(tester, [_item(isRead: true)]);

    expect(find.text('یادآوری نوبت'), findsOneWidget);
    expect(find.byIcon(Icons.circle), findsNothing);
  });

  testWidgets('offers both tabs and a mark-all-read action', (tester) async {
    await _pump(tester, [_item()]);

    expect(find.text('همه'), findsOneWidget);
    expect(find.text('خوانده‌نشده'), findsOneWidget);
    expect(find.text('همه را خوانده'), findsOneWidget);
  });

  testWidgets('shows the empty state when nothing has arrived', (tester) async {
    await _pump(tester, const []);

    expect(find.text('اعلان جدیدی ندارید'), findsOneWidget);
  });
}
