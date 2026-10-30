import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/boya_app_bar.dart';
import '../../data/notifications_api.dart';
import '../../domain/notification_item.dart';

/// Where a tapped notification lands. Every target is a route the app owns, so
/// a tap never ends on a dead path; an unmapped type stays on this screen.
const Map<String, String> _notificationRoutes = {
  'booking_created': '/profile/bookings',
  'booking_confirmed': '/profile/bookings',
  'booking_cancelled': '/profile/bookings',
  'booking_reminder': '/profile/bookings',
  'referral_reward': '/referral',
  'referral_completed': '/referral',
  'loyalty_points': '/loyalty',
};

IconData _iconFor(String type) {
  switch (type) {
    case 'booking_confirmed':
      return Icons.check_circle_outline;
    case 'booking_created':
      return Icons.event_note_outlined;
    case 'booking_cancelled':
      return Icons.event_busy_outlined;
    case 'booking_reminder':
      return Icons.schedule_outlined;
    case 'feedback_reminder':
      return Icons.rate_review_outlined;
    case 'referral_reward':
    case 'referral_completed':
      return Icons.card_giftcard_outlined;
    case 'loyalty_points':
      return Icons.star_border_rounded;
    default:
      return Icons.notifications_none;
  }
}

/// Relative age, e.g. «۵ دقیقه پیش». Anything older than a week falls back to
/// the Jalali date, which is what a customer reads for a past booking.
String relativeTimeLabel(DateTime createdAt) {
  final elapsed = DateTime.now().difference(createdAt);
  if (elapsed.inMinutes < 1) return 'همین حالا';
  if (elapsed.inMinutes < 60) return '${toPersianDigits(elapsed.inMinutes)} دقیقه پیش';
  if (elapsed.inHours < 24) return '${toPersianDigits(elapsed.inHours)} ���� �?�';
  if (elapsed.inDays < 7) return '${toPersianDigits(elapsed.inDays)} روز پیش';
  return formatJalaliDate(createdAt);
}
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  /// Marks the row read, resyncs both providers, then follows the type. A failed
  /// mark-read still navigates: the customer asked to see the booking, and the
  /// unread flag is not worth blocking them for.
  Future<void> _open(NotificationItem item) async {
    if (!item.isRead) {
      try {
        await ref.read(notificationsApiProvider).markRead(item.id);
      } catch (_) {
        // Swallowed on purpose: the invalidate below resyncs from the server.
      }
      ref.invalidate(notificationsListProvider);
      ref.invalidate(unreadCountProvider);
    }
    final route = _notificationRoutes[item.type];
    if (route != null && mounted) context.push(route);
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(notificationsApiProvider).markAllRead();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(messageFromDio(error))));
      return;
    }
    ref.invalidate(notificationsListProvider);
    ref.invalidate(unreadCountProvider);
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: BoyaAppBar(
          title: '�������',
          actions: [TextButton(onPressed: _markAllRead, child: const Text('همه را خوانده'))],
          bottom: const TabBar(tabs: [Tab(text: 'همه'), Tab(text: 'خوانده‌نشده')]),
        ),
        body: TabBarView(
          children: [
            _NotificationList(unreadOnly: false, onTap: _open),
            _NotificationList(unreadOnly: true, onTap: _open),
          ],
        ),
      ),
    );
  }
}
class _NotificationList extends ConsumerWidget {
  const _NotificationList({required this.unreadOnly, required this.onTap});

  final bool unreadOnly;
  final ValueChanged<NotificationItem> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(notificationsListProvider);
    return page.when(
      data: (page) {
        // Filtered after the request: the endpoint has no unread-only query, and
        // a second call would be free to disagree with the list it describes.
        final items = unreadOnly
            ? page.items.where((item) => !item.isRead).toList(growable: false)
            : page.items;
        if (items.isEmpty) return const _EmptyState();
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(notificationsListProvider),
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1, color: BoyaColors.line),
            itemBuilder: (context, index) => _NotificationRow(
              item: items[index],
              onTap: () => onTap(items[index]),
            ),
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
      error: (_, _) => Center(
        child: TextButton(
          onPressed: () => ref.invalidate(notificationsListProvider),
          child: const Text('��� �� ��?��� �������', style: BoyaTypography.body),
        ),
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.item, required this.onTap});

  final NotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: CircleAvatar(
        backgroundColor: BoyaColors.primarySubtle,
        child: Icon(_iconFor(item.type), color: BoyaColors.primary, size: 22),
      ),
      title: Text(
        item.title,
        style: BoyaTypography.body.copyWith(
          fontWeight: item.isRead ? FontWeight.w400 : FontWeight.w700,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Text(item.body, style: BoyaTypography.caption.copyWith(color: BoyaColors.inkMuted)),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(relativeTimeLabel(item.createdAt), style: BoyaTypography.overline),
          // The blue dot is the only unread cue inside the row, so the state
          // survives a glance down a long list.
          if (!item.isRead) ...[
            const SizedBox(width: 8),
            const Icon(Icons.circle, size: 8, color: BoyaColors.info),
          ],
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: constraints.maxHeight,
            child: const Center(child: Text('����� ��?�? ����?�', style: BoyaTypography.body)),
          ),
        ],
      ),
    );
  }
}