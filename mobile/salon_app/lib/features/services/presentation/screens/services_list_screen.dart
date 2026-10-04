import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../data/services_api.dart';
import '../../domain/service_line.dart';

/// Services under one service line. Services are not approval-gated, so an
/// edit here is live as soon as it is saved.
class ServicesListScreen extends ConsumerWidget {
  const ServicesListScreen({required this.lineId, super.key});

  final String lineId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(lineServicesProvider(lineId));

    return Scaffold(
      appBar: const SalonAppBar(title: 'خدمات لاین'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(serviceCreatePath(lineId), extra: lineId),
        icon: const Icon(Icons.add),
        label: const Text('خدمت جدید'),
      ),
      body: servicesAsync.when(
        data: (services) {
          if (services.isEmpty) {
            return const Center(
              child: Text('خدمتی در این لاین ثبت نشده است', style: BoyaTypography.body),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(lineServicesProvider(lineId).future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final service in services) ...[
                  _ServiceCard(lineId: lineId, service: service),
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
                onPressed: () => ref.invalidate(lineServicesProvider(lineId)),
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceCard extends ConsumerWidget {
  const _ServiceCard({required this.lineId, required this.service});

  final String lineId;
  final SalonService service;

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف خدمت'),
        content: Text('خدمت «${service.name}» حذف شود؟'),
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
      await ref.read(servicesApiProvider).deleteService(service.id);
      ref.invalidate(lineServicesProvider(lineId));
      ref.invalidate(serviceLinesProvider);
      messenger.showSnackBar(const SnackBar(content: Text('خدمت حذف شد')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: const Icon(Icons.spa_outlined, color: BoyaColors.primary),
        title: Text(service.name, style: BoyaTypography.title),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (service.description != null && service.description!.isNotEmpty)
              Text(service.description!, style: BoyaTypography.caption, maxLines: 2),
            const SizedBox(height: 4),
            Text(formatPrice(service.price), style: BoyaTypography.caption),
            const SizedBox(height: 4),
            Text(
              formatDurationMinutes(service.durationMinutes),
              style: BoyaTypography.caption,
            ),
            if (service.depositRequired && service.depositAmount != null) ...[
              const SizedBox(height: 4),
              Text(
                'بیعانه: ${formatPrice(service.depositAmount!)}',
                style: BoyaTypography.caption,
              ),
            ],
            if (!service.isActive) ...[
              const SizedBox(height: 4),
              Text(
                'غیرفعال',
                style: BoyaTypography.overline.copyWith(color: BoyaColors.inkMuted),
              ),
            ],
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (value) {
            switch (value) {
              case 'edit':
                context.push(serviceEditPath(service.id), extra: service);
              case 'delete':
                _confirmDelete(context, ref);
            }
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'edit', child: Text('ویرایش')),
            PopupMenuItem(value: 'delete', child: Text('حذف')),
          ],
        ),
        onTap: () => context.push(serviceEditPath(service.id), extra: service),
      ),
    );
  }
}
