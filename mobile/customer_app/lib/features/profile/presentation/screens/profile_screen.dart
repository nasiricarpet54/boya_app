import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/boya_app_bar.dart';
import '../../../notifications/data/notifications_api.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/profile_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(currentUserProvider);
    final unread = ref.watch(unreadCountProvider).value ?? 0;
    return Scaffold(
      appBar: const BoyaAppBar(title: 'پروفایل'),
      body: userAsync.when(
        data: (user) => ListView(
          children: [
            ColoredBox(
              color: BoyaColors.primarySubtle,
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 48,
                      backgroundColor: BoyaColors.primary,
                      child: Text(user.initial, style: BoyaTypography.display.copyWith(color: BoyaColors.white)),
                    ),
                    const SizedBox(height: 16),
                    Text(user.fullName.isEmpty ? 'کاربر بویا' : user.fullName, style: BoyaTypography.headline),
                    const SizedBox(height: 4),
                    Text(
                      user.phone.isEmpty ? 'شماره ثبت نشده' : toPersianDigits(user.phone),
                      style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
                    ),
                  ],
                ),
              ),
            ),
            _MenuItem(icon: Icons.calendar_month, title: 'رزروهای من', onTap: () => context.push('/profile/bookings')),
            _MenuItem(
              icon: Icons.notifications_outlined,
              title: 'اعلان‌ها',
              onTap: () => context.push('/notifications'),
              // Same counter as the home bell, so the two never disagree.
              badge: unread,
            ),
            _MenuItem(
              icon: Icons.support_agent,
              title: 'پشتیبانی',
              onTap: () => context.push('/support'),
            ),
            _MenuItem(
              icon: Icons.logout,
              title: 'خروج از حساب',
              color: BoyaColors.error,
              // Signing out has to go through the controller: navigating alone
              // left the session and the refresh token alive on the device.
              onTap: () async {
                await ref.read(authControllerProvider.notifier).logout();
                if (context.mounted) context.go('/auth/login');
              },
            ),
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (_, _) => const Center(child: Text('خطا در دریافت اطلاعات', style: BoyaTypography.body)),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({required this.icon, required this.title, required this.onTap, this.color, this.badge = 0});

  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final Color? color;

  /// Unread notifications; zero hides the badge entirely.
  final int badge;

  @override
  Widget build(BuildContext context) {
    final tone = color ?? BoyaColors.ink;
    return ListTile(
      leading: Icon(icon, color: tone),
      title: Text(title, style: BoyaTypography.body.copyWith(color: tone)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (badge > 0) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: const BoxDecoration(
                color: BoyaColors.error,
                borderRadius: BorderRadius.all(Radius.circular(10)),
              ),
              child: Text(
                toPersianDigits(badge > 99 ? 99 : badge),
                style: BoyaTypography.overline.copyWith(color: BoyaColors.white),
              ),
            ),
            const SizedBox(width: 8),
          ],
          const Icon(Icons.chevron_left, color: BoyaColors.inkMuted),
        ],
      ),
      onTap: onTap,
    );
  }
}
