import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/upload_api.dart';
import '../../../../shared/widgets/image_upload_field.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../salon/data/salon_api.dart';
import '../../../salon/presentation/widgets/approval_status_banner.dart';
import '../../../specialists/data/specialist_api.dart';
import '../../../specialists/domain/salon_specialist.dart';
import '../../../specialists/presentation/screens/specialist_setup_screen.dart';
import '../../data/portfolio_api.dart';
import '../../domain/portfolio_item.dart';

/// Portfolio (نمونه‌کارها) management of the salon panel: a grid of every
/// photo of every specialist, reachable from the profile menu.
///
/// Every write flips the salon to `pending_approval`, so the
/// [ApprovalStatusBanner] sits above the grid and both providers are
/// invalidated after each write — the banner's own [salonStatusProvider]
/// read is what tells the owner the change is waiting for an admin.
class PortfolioManageScreen extends ConsumerWidget {
  const PortfolioManageScreen({super.key});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, PortfolioItem item) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف نمونه‌کار'),
        content: const Text('این تصویر از نمونه‌کارها حذف شود؟'),
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
      await ref.read(portfolioApiProvider).deletePortfolioItem(item.id);
      ref
        ..invalidate(portfolioListProvider)
        ..invalidate(salonStatusProvider);
      messenger.showSnackBar(const SnackBar(content: Text('حذف شد؛ در انتظار تایید ادمین')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  Future<void> _showAddDialog(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final specialists = ref.read(specialistListProvider).value ?? const <SalonSpecialist>[];
    if (specialists.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('ابتدا یک متخصص ثبت کنید')),
      );
      return;
    }

    final added = await showDialog<bool>(
      context: context,
      builder: (context) => _AddPhotoDialog(specialists: specialists),
    );
    if (added != true) return;

    ref
      ..invalidate(portfolioListProvider)
      ..invalidate(salonStatusProvider);
    messenger.showSnackBar(const SnackBar(content: Text('ثبت شد؛ در انتظار تایید ادمین')));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portfolioAsync = ref.watch(portfolioListProvider);
    final isSpecialist = ref.watch(authControllerProvider).user?.role == 'specialist';
    // The specialist's own row: `mySpecialist` asks the panel's specialist list
    // and picks the row whose `userId` matches the signed-in account, so a
    // specialist only ever sees their own gallery.
    final mineAsync = ref.watch(mySpecialistProvider);
    final mine = mineAsync.valueOrNull;

    return Scaffold(
      appBar: const SalonAppBar(title: 'نمونه‌کارها'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddDialog(context, ref),
        icon: const Icon(Icons.add_a_photo_outlined),
        label: const Text('تصویر جدید'),
      ),
      body: portfolioAsync.when(
        data: (items) {
          // A specialist manages only their own gallery; the owner sees all.
          final visible = isSpecialist && mine != null
              ? items.where((item) => item.specialistId == mine.id).toList()
              : items;
          return RefreshIndicator(
            onRefresh: () => ref.refresh(portfolioListProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const ApprovalStatusBanner(),
                if (visible.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 64),
                    child: Center(
                      child: Text('هنوز نمونه‌کاری ثبت نشده است', style: BoyaTypography.body),
                    ),
                  )
                else
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    children: [
                      for (final item in visible)
                        _PortfolioTile(
                          item: item,
                          onTap: () => _confirmDelete(context, ref, item),
                        ),
                    ],
                  ),
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
                onPressed: () => ref.invalidate(portfolioListProvider),
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dialog behind the «تصویر جدید» action: pick one of the salon's
/// specialists, paste an image URL, save. The POST happens here — including
/// the `pending_approval` toast the parent shows — so the dialog owns its
/// own saving/error state.
class _AddPhotoDialog extends ConsumerStatefulWidget {
  const _AddPhotoDialog({required this.specialists});

  final List<SalonSpecialist> specialists;

  @override
  ConsumerState<_AddPhotoDialog> createState() => _AddPhotoDialogState();
}

class _AddPhotoDialogState extends ConsumerState<_AddPhotoDialog> {
  final _urlController = TextEditingController();
  String? _specialistId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _specialistId = widget.specialists.first.id;
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;
    final specialistId = _specialistId;
    if (specialistId == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(portfolioApiProvider).addPortfolioItem(
            specialistId: specialistId,
            imageUrl: url,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(messageFromDio(error))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('افزودن نمونه‌کار'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<String>(
            // ignore: deprecated_member_use
            value: _specialistId,
            decoration: const InputDecoration(labelText: 'متخصص'),
            items: [
              for (final specialist in widget.specialists)
                DropdownMenuItem(
                  value: specialist.id,
                  child: Text(specialist.fullName ?? 'متخصص'),
                ),
            ],
            onChanged: (value) => setState(() => _specialistId = value),
          ),
          const SizedBox(height: 12),
          ImageUploadField(
            label: 'تصویر نمونه‌کار',
            category: 'portfolio',
            value: _urlController.text,
            onChanged: (url) => setState(() => _urlController.text = url),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('انصراف'),
        ),
        TextButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('ثبت'),
        ),
      ],
    );
  }
}

class _PortfolioTile extends StatelessWidget {
  const _PortfolioTile({required this.item, required this.onTap});

  final PortfolioItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: AspectRatio(
          aspectRatio: 1,
          child: Image.network(
            resolveUploadUrl(item.imageUrl),
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => ColoredBox(
              color: BoyaColors.line,
              child: const Icon(Icons.broken_image_outlined, color: BoyaColors.inkMuted),
            ),
          ),
        ),
      ),
    );
  }
}
