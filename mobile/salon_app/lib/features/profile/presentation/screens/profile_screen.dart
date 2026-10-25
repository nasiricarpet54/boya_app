import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/navigation/salon_shell.dart';
import '../../../../core/network/upload_api.dart';
import '../../../../core/router/app_router.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../salon/data/salon_api.dart';
import '../../../salon/domain/salon_profile.dart';
import '../../../salon/presentation/widgets/approval_status_banner.dart';

/// Profile tab of the salon panel: the salon's identity card, a couple of
/// headline stats, and the management shortcuts.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(salonProfileProvider);
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      appBar: const SalonAppBar(title: 'پروفایل'),
      body: profileAsync.when(
        data: (profile) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Sits above the identity card because it changes how the card
            // should be read: the values below are the last approved ones.
            ApprovalStatusBanner(onEdit: () => context.push(salonEditPath)),
            _SalonHeader(profile: profile, userFullName: user?.fullName),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    label: 'متخصصان',
                    value: toPersianDigits('${profile.specialistsCount}'),
                    icon: Icons.people_outline,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    label: 'امتیاز',
                    value: toPersianDigits(profile.rating.toStringAsFixed(1)),
                    icon: Icons.star_outline,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _MenuItem(
              icon: Icons.edit_outlined,
              title: 'ویرایش اطلاعات سالن',
              onTap: () => context.push(salonEditPath),
            ),
            _MenuItem(
              icon: Icons.miscellaneous_services_outlined,
              title: 'مدیریت خدمات',
              onTap: () => context.push(serviceLinesPath),
            ),
            _MenuItem(
              icon: Icons.people_outline,
              title: 'مدیریت متخصصان',
              onTap: () => context.push(specialistsPath),
            ),
            _MenuItem(
              icon: Icons.schedule_outlined,
              title: 'ساعات کاری',
              onTap: () => context.push(salonWorkingHoursPath),
            ),
            _MenuItem(
              icon: Icons.block_outlined,
              title: 'زمان‌های مسدود',
              onTap: () => context.push(salonBlocksPath),
            ),
            _MenuItem(
              icon: Icons.photo_library_outlined,
              title: 'نمونه‌کارها',
              onTap: () => context.push(portfolioPath),
            ),
            _MenuItem(
              icon: Icons.logout,
              title: 'خروج از حساب',
              color: BoyaColors.error,
              onTap: () => logoutAndGo(context, ref),
            ),
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (_, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('خطا در دریافت اطلاعات سالن', style: BoyaTypography.body),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => ref.invalidate(salonProfileProvider),
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SalonHeader extends StatelessWidget {
  const _SalonHeader({required this.profile, this.userFullName});

  final SalonProfile profile;
  final String? userFullName;

  @override
  Widget build(BuildContext context) {
    final coverImage = profile.coverImage;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: BoyaColors.primarySubtle,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            CircleAvatar(
              radius: 40,
              backgroundColor: BoyaColors.primary,
              backgroundImage: coverImage != null && coverImage.isNotEmpty
                  ? NetworkImage(resolveUploadUrl(coverImage))
                  : null,
              child: coverImage == null || coverImage.isEmpty
                  ? Text(
                      profile.name.isEmpty ? 'س' : profile.name.characters.first,
                      style: BoyaTypography.display.copyWith(color: BoyaColors.white),
                    )
                  : null,
            ),
            const SizedBox(height: 12),
            Text(profile.name.isEmpty ? 'سالن بویا' : profile.name, style: BoyaTypography.headline),
            if (userFullName != null && userFullName!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(userFullName!, style: BoyaTypography.body),
            ],
            if (profile.phone != null && profile.phone!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(toPersianDigits(profile.phone!), style: BoyaTypography.caption),
            ],
            if (profile.address != null && profile.address!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(profile.address!, style: BoyaTypography.caption, textAlign: TextAlign.center),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: BoyaColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BoyaColors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, color: BoyaColors.primary),
            const SizedBox(height: 8),
            Text(value, style: BoyaTypography.title),
            const SizedBox(height: 2),
            Text(label, style: BoyaTypography.caption),
          ],
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({required this.icon, required this.title, required this.onTap, this.color});

  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tone = color ?? BoyaColors.ink;
    return ListTile(
      leading: Icon(icon, color: tone),
      title: Text(title, style: BoyaTypography.body.copyWith(color: tone)),
      trailing: const Icon(Icons.chevron_left, color: BoyaColors.inkMuted),
      onTap: onTap,
    );
  }
}
