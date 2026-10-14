import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/image_upload_field.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../data/specialist_api.dart';
import '../../domain/salon_specialist.dart';
import '../../domain/specialist_form.dart';

/// Create or edit a specialist.
///
/// Passed a [SalonSpecialist] via [GoRouterState.extra] when editing; `null`
/// means create. Create asks for phone and full name — the phone is the join
/// key into `users` on the backend — while edit is bio, skills and commission
/// only, because the backend's PATCH takes no identity fields. Every
/// specialist write is immediate (`approved`), so there is no pending-
/// confirmation state here.
class SpecialistFormScreen extends ConsumerStatefulWidget {
  const SpecialistFormScreen({super.key});

  @override
  ConsumerState<SpecialistFormScreen> createState() => _SpecialistFormScreenState();
}

class _SpecialistFormScreenState extends ConsumerState<SpecialistFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _bioController = TextEditingController();
  final _commissionController = TextEditingController();
  final _skillController = TextEditingController();

  SpecialistForm? _form;
  bool _seeded = false;
  bool _saving = false;

  /// The portrait sent with the next save: the seeded URL while editing
  /// (re-sent unchanged unless the user touches it), `''` when there is no
  /// photo — which the backend reads as "clear the picture".
  String _avatarUrl = '';

  bool get _isEditing => _form?.isEditing ?? false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _seed());
  }

  void _seed() {
    if (_seeded) return;
    _seeded = true;
    final extra = GoRouterState.of(context).extra;
    if (extra is SalonSpecialist) {
      final form = SpecialistForm.fromSpecialist(extra);
      _form = form;
      _avatarUrl = extra.avatarUrl ?? '';
      _fullNameController.text = form.fullName;
      _phoneController.text = form.phone;
      _bioController.text = form.bio;
      _commissionController.text =
          toPersianDigits('${(form.commissionRate ?? SpecialistForm.defaultCommissionRate).round()}');
    } else {
      _form = SpecialistForm();
      _commissionController.text =
          toPersianDigits('${SpecialistForm.defaultCommissionRate.round()}');
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    _commissionController.dispose();
    _skillController.dispose();
    super.dispose();
  }

  void _addSkill() {
    final value = _skillController.text.trim();
    if (value.isEmpty) return;
    setState(() {
      _form!.skills.add(value);
      _skillController.clear();
    });
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final form = _form!;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);
    try {
      final api = ref.read(specialistApiProvider);
      final commission = form.parseCommission(_commissionController.text) ??
          form.commissionRate ??
          SpecialistForm.defaultCommissionRate;

      // Controllers are the live values; mirror them onto the form so the
      // payloads see what the validators just approved.
      form
        ..fullName = _fullNameController.text
        ..phone = _phoneController.text
        ..bio = _bioController.text
        ..commissionRate = commission;

      if (_isEditing) {
        await api.updateSpecialist(
          form.specialistId!,
          bio: form.bio.trim(),
          skills: List<String>.of(form.skills),
          commissionRate: commission,
          avatarUrl: _avatarUrl,
        );
      } else {
        await api.createSpecialist(
          phone: form.normalisedPhone,
          fullName: form.fullName.trim(),
          bio: form.bio.trim().isEmpty ? null : form.bio.trim(),
          skills: List<String>.of(form.skills),
          commissionRate: commission,
          avatarUrl: _avatarUrl,
        );
      }

      ref.invalidate(specialistListProvider);
      messenger.showSnackBar(const SnackBar(content: Text('ذخیره شد')));
      if (mounted) context.pop();
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Toggles ADR-011's on-site switch and persists it immediately.
  ///
  /// Unlike the bio/skills draft, this is an operational flag on the level of
  /// the commission rate, so it gets its own PATCH the moment it changes rather
  /// than waiting for the save button: leaving the screen with the switch on
  /// must not silently drop the salon's mobile availability. The flip is
  /// optimistic and rolls back when the write fails, so the switch never shows
  /// a state the server does not have.
  Future<void> _toggleMobileService(bool value) async {
    final form = _form;
    if (form == null || !form.isEditing) return;
    final messenger = ScaffoldMessenger.of(context);
    final previous = form.offersMobileService;
    setState(() => form.offersMobileService = value);
    try {
      await ref
          .read(specialistApiProvider)
          .updateSpecialist(form.specialistId!, offersMobileService: value);
      // The list behind this screen shows the flag as a badge, so it needs the
      // new value even though the form keeps its own copy.
      ref.invalidate(specialistListProvider);
      messenger.showSnackBar(
        SnackBar(content: Text(value ? 'خدمات سیار برای این متخصص فعال شد' : 'خدمات سیار برای این متخصص غیرفعال شد')),
      );
    } catch (error) {
      if (mounted) setState(() => form.offersMobileService = previous);
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_form == null) {
      // extra has not been read yet; the first frame shows a plain scaffold.
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final form = _form!;
    return Scaffold(
      appBar: SalonAppBar(title: _isEditing ? 'ویرایش متخصص' : 'متخصص جدید'),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ImageUploadField(
              label: 'عکس پروفایل متخصص',
              category: 'specialist',
              value: _avatarUrl,
              onChanged: (url) => setState(() => _avatarUrl = url),
            ),
            const SizedBox(height: 16),
            if (_isEditing) ...[
              // Identity is read-only on edit: the backend PATCH takes bio,
              // skills and commission only, so the header shows what was
              // registered instead of offering fields that would not save.
              DecoratedBox(
                decoration: BoxDecoration(
                  color: BoyaColors.primarySubtle,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(form.fullName, style: BoyaTypography.title),
                      const SizedBox(height: 4),
                      Text(
                        toPersianDigits(form.phone),
                        style: BoyaTypography.caption,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ] else ...[
              Text('نام متخصص', style: BoyaTypography.caption),
              const SizedBox(height: 4),
              TextFormField(
                controller: _fullNameController,
                maxLength: 200,
                decoration: const InputDecoration(
                  hintText: 'مثلاً مریم رضایی',
                  counterText: '',
                ),
                validator: (_) => form.validateFullName(),
              ),
              const SizedBox(height: 16),
              Text('شماره موبایل', style: BoyaTypography.caption),
              const SizedBox(height: 4),
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  hintText: '۰۹۱۲۱۲۳۴۵۶۷',
                  counterText: '',
                ),
                validator: (_) => form.validatePhone(),
              ),
              const SizedBox(height: 16),
            ],
            Text('بیوگرافی', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _bioController,
              maxLines: 3,
              maxLength: 1000,
              decoration: const InputDecoration(
                hintText: 'توضیح کوتاه درباره متخصص',
                counterText: '',
              ),
            ),
            const SizedBox(height: 16),
            Text('مهارت‌ها', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _skillController,
                    maxLength: 100,
                    decoration: const InputDecoration(
                      hintText: 'مثلاً رنگ',
                      counterText: '',
                    ),
                    onFieldSubmitted: (_) => _addSkill(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _addSkill,
                  icon: const Icon(Icons.add_circle_outline),
                  tooltip: 'افزودن مهارت',
                ),
              ],
            ),
            if (form.skills.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final skill in List<String>.of(form.skills))
                    InputChip(
                      label: Text(skill),
                      onDeleted: () => setState(() => form.skills.remove(skill)),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Text('پورسانت (٪)', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _commissionController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                hintText: 'مثلاً ۵۰',
                counterText: '',
              ),
              validator: (value) =>
                  form.validateCommission(form.parseCommission(value ?? '')),
            ),
            if (_isEditing) ...[
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('ارائه خدمات سیار', style: BoyaTypography.body),
                subtitle: const Text(
                  'اگر روشن باشد، این متخصص می‌تواند خدمت در محل مشتری ارائه دهد',
                ),
                value: form.offersMobileService,
                onChanged: _toggleMobileService,
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: BoyaColors.white,
                      ),
                    )
                  : const Text('ذخیره'),
            ),
          ],
        ),
      ),
    );
  }
}
