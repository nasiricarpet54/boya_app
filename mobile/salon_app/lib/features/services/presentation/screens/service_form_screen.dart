import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../data/services_api.dart';
import '../../domain/service_line.dart';

/// Create or edit a service under a line.
///
/// Carries either a [SalonService] (edit) or the owning line id (create) via
/// [GoRouterState.extra]. Services are not approval-gated: a save is live
/// immediately, so a plain snack bar is all the confirmation needed.
class ServiceFormScreen extends ConsumerStatefulWidget {
  const ServiceFormScreen({super.key});

  @override
  ConsumerState<ServiceFormScreen> createState() => _ServiceFormScreenState();
}

class _ServiceFormScreenState extends ConsumerState<ServiceFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _priceController = TextEditingController();
  final _durationController = TextEditingController();
  final _depositController = TextEditingController();

  SalonService? _service;
  String? _lineId;
  bool _depositRequired = false;
  bool _isActive = true;
  bool _seeded = false;
  bool _saving = false;

  bool get _isEditing => _service != null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _seed());
  }

  void _seed() {
    final extra = GoRouterState.of(context).extra;
    if (_seeded) return;
    _seeded = true;
    if (extra is SalonService) {
      _service = extra;
      _lineId = extra.lineId;
      _nameController.text = extra.name;
      _descriptionController.text = extra.description ?? '';
      _priceController.text = toPersianDigits(extra.price.round());
      _durationController.text = toPersianDigits(extra.durationMinutes);
      _depositRequired = extra.depositRequired;
      _depositController.text =
          extra.depositAmount == null ? '' : toPersianDigits(extra.depositAmount!.round());
      _isActive = extra.isActive;
    } else if (extra is String) {
      _lineId = extra;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    _durationController.dispose();
    _depositController.dispose();
    super.dispose();
  }

  num? _parseNumber(TextEditingController controller) {
    final raw = toLatinDigits(controller.text.trim()).replaceAll(',', '');
    return raw.isEmpty ? null : num.tryParse(raw);
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);
    try {
      final api = ref.read(servicesApiProvider);
      final name = _nameController.text.trim();
      final description = _descriptionController.text.trim();
      final price = _parseNumber(_priceController)?.toDouble() ?? 0;
      final duration = _parseNumber(_durationController)?.toInt();
      final deposit = _depositRequired ? _parseNumber(_depositController)?.toDouble() : null;

      if (_isEditing) {
        await api.updateService(
          _service!.id,
          name: name,
          price: price,
          durationMinutes: duration,
          depositRequired: _depositRequired,
          depositAmount: deposit,
          isActive: _isActive,
        );
      } else {
        await api.createService(
          _lineId!,
          name: name,
          price: price,
          description: description.isEmpty ? null : description,
          durationMinutes: duration,
          depositRequired: _depositRequired,
          depositAmount: deposit,
        );
      }

      ref.invalidate(lineServicesProvider(_lineId!));
      ref.invalidate(serviceLinesProvider);
      messenger.showSnackBar(const SnackBar(content: Text('ذخیره شد')));
      if (mounted) context.pop();
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: SalonAppBar(title: _isEditing ? 'ویرایش خدمت' : 'خدمت جدید'),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('نام خدمت', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _nameController,
              maxLength: 200,
              decoration: const InputDecoration(counterText: ''),
              validator: (value) =>
                  (value ?? '').trim().isEmpty ? 'نام خدمت را وارد کنید' : null,
            ),
            const SizedBox(height: 16),
            Text('توضیحات', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _descriptionController,
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(counterText: ''),
            ),
            const SizedBox(height: 16),
            Text('قیمت (تومان)', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _priceController,
              keyboardType: TextInputType.number,
              textDirection: TextDirection.ltr,
              inputFormatters: [_digitFormatter],
              decoration: const InputDecoration(hintText: '500000'),
              validator: (value) {
                final price = _parseNumber(_priceController);
                if (price == null) return 'قیمت را وارد کنید';
                return price > 0 ? null : 'قیمت باید بزرگ‌تر از صفر باشد';
              },
            ),
            const SizedBox(height: 16),
            Text('مدت (دقیقه)', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _durationController,
              keyboardType: TextInputType.number,
              textDirection: TextDirection.ltr,
              inputFormatters: [_digitFormatter],
              decoration: const InputDecoration(hintText: '60'),
              validator: (value) {
                final duration = _parseNumber(_durationController);
                if (duration == null) return null;
                return duration > 0 ? null : 'مدت باید مثبت باشد';
              },
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('نیاز به بیعانه', style: BoyaTypography.body),
              value: _depositRequired,
              onChanged: (value) => setState(() => _depositRequired = value),
            ),
            if (_depositRequired) ...[
              Text('مبلغ بیعانه (تومان)', style: BoyaTypography.caption),
              const SizedBox(height: 4),
              TextFormField(
                controller: _depositController,
                keyboardType: TextInputType.number,
                textDirection: TextDirection.ltr,
                inputFormatters: [_digitFormatter],
                decoration: const InputDecoration(hintText: '100000'),
                validator: (value) {
                  final deposit = _parseNumber(_depositController);
                  return deposit == null ? 'مبلغ بیعانه را وارد کنید' : null;
                },
              ),
            ],
            if (_isEditing) ...[
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('فعال', style: BoyaTypography.body),
                value: _isActive,
                onChanged: (value) => setState(() => _isActive = value),
              ),
            ],
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
          ],
        ),
      ),
    );
  }
}

/// Accepts Latin, Persian and Arabic-Indic digits — matching what the numeric
/// keypads produce — and drops everything else.
final _digitFormatter = FilteringTextInputFormatter.allow(RegExp(r'[0-9۰-۹٠-٩]'));
