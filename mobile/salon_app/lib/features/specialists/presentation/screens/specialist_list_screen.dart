import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../data/specialist_api.dart';
import '../../domain/salon_specialist.dart';

/// Specialist list of the salon panel: the tab screen behind the «متخصصان»
/// destination and the entry point to create and edit.
class SpecialistListScreen extends ConsumerWidget {
  const SpecialistListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final specialistsAsync = ref.watch(specialistListProvider);

    return Scaffold(
      appBar: const SalonAppBar(title: 'مدیریت متخصصان'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(specialistCreatePath),
        icon: const Icon(Icons.add),
        label: const Text('متخصص جدید'),
      ),
      body: specialistsAsync.when(
        data: (specialists) {
          if (specialists.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('متخصصی ثبت نشده است', style: BoyaTypography.body),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () => context.push(specialistInvitePath),
                    icon: const Icon(Icons.mail_outline),
                    label: const Text('دعوت متخصص'),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(specialistListProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: OutlinedButton.icon(
                    onPressed: () => context.push(specialistInvitePath),
                    icon: const Icon(Icons.mail_outline),
                    label: const Text('دعوت متخصص'),
                  ),
                ),
                const SizedBox(height: 12),
                for (final specialist in specialists) ...[
                  _SpecialistCard(specialist: specialist),
                  const SizedBox(height: 12),
                ],
              ],
            ),
          );
        },
        loading: () =>
            const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(messageFromDio(error), style: BoyaTypography.body),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(specialistListProvider),
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SpecialistCard extends ConsumerWidget {
  const _SpecialistCard({required this.specialist});

  final SalonSpecialist specialist;

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف متخصص'),
        content: Text('متخصص «${specialist.fullName ?? ''}» حذف شود؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('انصراف'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: BoyaColors.error),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      // The backend answers 400 «این متخصص رزرو فعال دارد» while bookings are
      // open; messageFromDio surfaces that exact text.
      await ref.read(specialistApiProvider).deleteSpecialist(specialist.id);
      ref.invalidate(specialistListProvider);
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  Future<void> _toggleActive(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(specialistApiProvider)
          .updateSpecialist(specialist.id, isActive: !specialist.isActive);
      ref.invalidate(specialistListProvider);
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = specialist.fullName ?? 'متخصص';
    final skillsLabel =
        specialist.skills.isEmpty ? (specialist.bio ?? '') : specialist.skills.join('، ');

    return Opacity(
      // Soft-deleted means hidden from the public catalogue, not gone: the
      // card stays, dimmed, with the action to bring the specialist back.
      opacity: specialist.isActive ? 1 : 0.55,
      child: Card(
        margin: EdgeInsets.zero,
        child: ListTile(
          leading: _SpecialistAvatar(specialist: specialist),
          title: Text(name, style: BoyaTypography.title),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (skillsLabel.isNotEmpty) ...[
                Text(skillsLabel, style: BoyaTypography.caption, maxLines: 2),
                const SizedBox(height: 4),
              ],
              Row(
                children: [
                  Text(
                    '${toPersianDigits(specialist.bookingsCount)} رزرو',
                    style: BoyaTypography.caption,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'پورسانت ${toPersianDigits('${specialist.commissionRate.round()}')}٪',
                    style: BoyaTypography.caption,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              _ActiveBadge(isActive: specialist.isActive),
            ],
          ),
          trailing: PopupMenuButton<String>(
            onSelected: (value) {
              switch (value) {
                case 'edit':
                  context.push(specialistEditPath(specialist.id), extra: specialist);
                case 'toggle':
                  _toggleActive(context, ref);
                case 'delete':
                  _confirmDelete(context, ref);
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'edit', child: Text('ویرایش')),
              PopupMenuItem(
                value: 'toggle',
                child: Text(specialist.isActive ? 'غیرفعال کردن' : 'فعال کردن'),
              ),
              const PopupMenuItem(value: 'delete', child: Text('حذف')),
            ],
          ),
          onTap: () => context.push(specialistEditPath(specialist.id), extra: specialist),
        ),
      ),
    );
  }
}

class _SpecialistAvatar extends StatelessWidget {
  const _SpecialistAvatar({required this.specialist});

  final SalonSpecialist specialist;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = specialist.avatarUrl;
    return CircleAvatar(
      radius: 22,
      backgroundColor: BoyaColors.primarySubtle,
      backgroundImage:
          avatarUrl != null && avatarUrl.isNotEmpty ? NetworkImage(avatarUrl) : null,
      child: avatarUrl == null || avatarUrl.isEmpty
          ? Text(
              specialist.initial,
              style: BoyaTypography.body.copyWith(color: BoyaColors.primary),
            )
          : null,
    );
  }
}

class _ActiveBadge extends StatelessWidget {
  const _ActiveBadge({required this.isActive});

  final bool isActive;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: isActive ? BoyaColors.successSubtle : BoyaColors.line,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isActive ? Icons.check_circle_outline : Icons.visibility_off_outlined,
              size: 14,
              color: isActive ? BoyaColors.success : BoyaColors.inkMuted,
            ),
            const SizedBox(width: 4),
            Text(
              isActive ? 'فعال' : 'غیرفعال',
              style: BoyaTypography.overline.copyWith(
                color: isActive ? BoyaColors.success : BoyaColors.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
