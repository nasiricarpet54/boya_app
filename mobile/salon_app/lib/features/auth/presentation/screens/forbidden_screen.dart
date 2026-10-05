import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/auth_controller.dart';

/// Shown when a signed-in account has no business in the salon panel.
///
/// The router sends every authenticated user whose role is not in
/// `salonPanelRoles` here, so this screen is reachable with a perfectly valid
/// token — it is a role failure, not an auth failure. Logging out is the only
/// useful action: retrying with the same account would land back here.
class ForbiddenScreen extends ConsumerWidget {
  const ForbiddenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      backgroundColor: BoyaColors.surface,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.block, size: 64, color: BoyaColors.error),
                const SizedBox(height: 24),
                Text(
                  'شما به این پنل دسترسی ندارید',
                  style: BoyaTypography.headline,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'این حساب برای پنل سالن بویا ساخته نشده است. اگر فکر می‌کنید این اشتباه است با مدیر سالن تماس بگیرید.',
                  style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
                  textAlign: TextAlign.center,
                ),
                // Naming the role makes the "logged in but wrong role" case
                // obvious to support, instead of looking like a broken login.
                if (user != null && user.role.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    'نقش حساب: ${user.role}',
                    style: BoyaTypography.overline,
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 32),
                OutlinedButton(
                  onPressed: () async {
                    await ref.read(authControllerProvider.notifier).logout();
                    if (context.mounted) context.go('/auth/login');
                  },
                  child: const Text('خروج'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}