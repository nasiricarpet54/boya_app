import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../../salon/domain/salon_status.dart';
import '../../data/services_api.dart';
import '../../domain/service_line.dart';

/// Create or edit a service line.
///
/// Passed a [ServiceLine] via [GoRouterState.extra] when editing; `null` means
/// create. A create, and any edit that changes the name, is approval-gated on
/// the backend and the banner confirms it after save.
class LineFormScreen extends ConsumerStatefulWidget {
  const LineFormScreen({super.key});

  @override
  ConsumerState<LineFormScreen> createState() => _LineFormScreenState();
}

class _LineFormScreenState extends ConsumerState<LineFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();

  ServiceLine? _line;
  bool _seeded = false;
  bool _saving = false;
  SalonApprovalStatus? _lastResult;

  bool get _isEditing => _line != null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _seed());
  }

  void _seed() {
    final extra = GoRouterState.of(context).extra;
    if (_seeded) return;
    _seeded = true;
    if (extra is ServiceLine) {
      _line = extra;
      _nameController.text = extra.name;
      _descriptionController.text = extra.description ?? '';
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);
    try {
      final api = ref.read(servicesApiProvider);
      final name = _nameController.text.trim();
      final description = _descriptionController.text.trim();
      final result = _isEditing
          ? await api.updateLine(
              _line!.id,
              name: name.isEmpty ? null : name,
              description: description.isEmpty ? null : description,
            )
          : await api.createLine(
              name: name,
              description: description.isEmpty ? null : description,
            );

      ref.invalidate(serviceLinesProvider);

      final nameChanged = _isEditing && name != _line!.name;
      if (result.status == SalonApprovalStatus.pendingApproval || nameChanged) {
        setState(() => _lastResult = SalonApprovalStatus.pendingApproval);
      } else {
        messenger.showSnackBar(const SnackBar(content: Text('ذخیره شد')));
        if (mounted) context.pop();
      }
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_lastResult == SalonApprovalStatus.pendingApproval) {
      return _PendingConfirmation(onDone: () => context.pop());
    }
    return Scaffold(
      appBar: SalonAppBar(title: _isEditing ? 'ویرایش لاین' : 'لاین جدید'),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('نام لاین', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _nameController,
              maxLength: 100,
              decoration: const InputDecoration(hintText: 'مثلاً رنگ و مش', counterText: ''),
              validator: (value) =>
                  (value ?? '').trim().isEmpty ? 'نام لاین را وارد کنید' : null,
            ),
            const SizedBox(height: 16),
            Text('توضیحات', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _descriptionController,
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(
                hintText: 'توضیح کوتاه درباره این لاین',
                counterText: '',
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2, color: BoyaColors.white),
                    )
                  : const Text('ذخیره'),
            ),
            if (_isEditing) ...[
              const SizedBox(height: 8),
              Text(
                'تغییر نام لاین پس از تایید ادمین اعمال می‌شود.',
                style: BoyaTypography.overline,
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PendingConfirmation extends StatelessWidget {
  const _PendingConfirmation({required this.onDone});

  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SalonAppBar(title: 'لاین خدماتی'),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.hourglass_top_outlined, size: 56, color: BoyaColors.warning),
              const SizedBox(height: 16),
              Text('لاین ثبت شد و در انتظار تایید ادمین است', style: BoyaTypography.title),
              const SizedBox(height: 8),
              Text(
                'تا پیش از تایید، این لاین در کاتالوگ عمومی نمایش داده نمی‌شود.',
                style: BoyaTypography.body,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton(onPressed: onDone, child: const Text('بازگشت به فهرست')),
            ],
          ),
        ),
      ),
    );
  }
}
