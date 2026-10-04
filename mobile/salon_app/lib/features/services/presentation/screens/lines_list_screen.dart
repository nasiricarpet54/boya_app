import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../../salon/domain/salon_status.dart';
import '../../../salon/presentation/widgets/approval_status_banner.dart';
import '../../data/services_api.dart';
import '../../domain/service_line.dart';

/// Service-line list of the salon panel. A line collects the services under it
/// and is the entry point to the per-line service list.
class LinesListScreen extends ConsumerWidget {
  const LinesListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linesAsync = ref.watch(serviceLinesProvider);

    return Scaffold(
      appBar: const SalonAppBar(title: 'لاین‌های خدماتی'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(serviceLineCreatePath),
        icon: const Icon(Icons.add),
        label: const Text('لاین جدید'),
      ),
      body: linesAsync.when(
        data: (lines) {
          if (lines.isEmpty) {
            return const Center(
              child: Text('لاینی ثبت نشده است', style: BoyaTypography.body),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(serviceLinesProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const ApprovalStatusBanner(),
                for (final line in lines) ...[
                  _LineCard(line: line),
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
                onPressed: () => ref.invalidate(serviceLinesProvider),
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LineCard extends ConsumerWidget {
  const _LineCard({required this.line});

  final ServiceLine line;

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف لاین خدماتی'),
        content: Text('لاین «${line.name}» حذف شود؟'),
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
      await ref.read(servicesApiProvider).deleteLine(line.id);
      ref.invalidate(serviceLinesProvider);
      messenger.showSnackBar(const SnackBar(content: Text('لاین حذف شد')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: const Icon(Icons.category_outlined, color: BoyaColors.primary),
        title: Text(line.name, style: BoyaTypography.title),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (line.description != null && line.description!.isNotEmpty)
              Text(line.description!, style: BoyaTypography.caption, maxLines: 2),
            const SizedBox(height: 4),
            Text(
              '${toPersianDigits(line.servicesCount)} خدمت',
              style: BoyaTypography.caption,
            ),
            const SizedBox(height: 4),
            _StateBadge(line: line),
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (value) {
            switch (value) {
              case 'services':
                context.push(lineServicesPath(line.id));
              case 'edit':
                context.push(lineEditPath(line.id), extra: line);
              case 'delete':
                _confirmDelete(context, ref);
            }
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'services', child: Text('خدمات این لاین')),
            PopupMenuItem(value: 'edit', child: Text('ویرایش')),
            PopupMenuItem(value: 'delete', child: Text('حذف')),
          ],
        ),
        onTap: () => context.push(lineServicesPath(line.id)),
      ),
    );
  }
}

/// Wire-form badge for a line's approval state, plus its active flag.
class _StateBadge extends StatelessWidget {
  const _StateBadge({required this.line});

  final ServiceLine line;

  @override
  Widget build(BuildContext context) {
    if (!line.isActive) {
      return _Badge(
        label: 'غیرفعال',
        color: BoyaColors.inkMuted,
        background: BoyaColors.line,
        icon: Icons.visibility_off_outlined,
      );
    }
    switch (line.status) {
      case SalonApprovalStatus.pendingApproval:
      case SalonApprovalStatus.draft:
        return const _Badge(
          label: 'در انتظار تایید',
          color: BoyaColors.warning,
          background: BoyaColors.warningSubtle,
          icon: Icons.hourglass_top_outlined,
        );
      case SalonApprovalStatus.rejected:
        return const _Badge(
          label: 'رد شده',
          color: BoyaColors.error,
          background: BoyaColors.errorSubtle,
          icon: Icons.cancel_outlined,
        );
      case SalonApprovalStatus.suspended:
        return const _Badge(
          label: 'تعلیق‌شده',
          color: BoyaColors.error,
          background: BoyaColors.errorSubtle,
          icon: Icons.block,
        );
      case SalonApprovalStatus.approved:
        return const _Badge(
          label: 'تاییدشده',
          color: BoyaColors.success,
          background: BoyaColors.successSubtle,
          icon: Icons.check_circle_outline,
        );
    }
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    required this.background,
    required this.icon,
  });

  final String label;
  final Color color;
  final Color background;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(label, style: BoyaTypography.overline.copyWith(color: color)),
          ],
        ),
      ),
    );
  }
}
