import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../application/salon_edit_controller.dart';
import '../../data/salon_api.dart';
import '../../domain/salon_profile.dart';
import '../../domain/salon_status.dart';
import '../widgets/approval_status_banner.dart';

/// The approval-gated salon profile form.
///
/// Every field here is queued for an admin rather than written live, so the
/// form is prefilled from `GET /salon/me` (the last approved values) and a
/// successful save says so explicitly instead of pretending the card on the
/// profile tab has already changed.
class SalonEditScreen extends ConsumerStatefulWidget {
  const SalonEditScreen({super.key});

  @override
  ConsumerState<SalonEditScreen> createState() => _SalonEditScreenState();
}

class _SalonEditScreenState extends ConsumerState<SalonEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  final _coverImageController = TextEditingController();

  /// The form is seeded once. A rebuild (including the one that follows a save
  /// invalidating the profile) must never overwrite what the user is typing.
  bool _seeded = false;

  @override
  void initState() {
    super.initState();
    // The profile may already be cached from the profile tab, and may arrive
    // later on a cold entry — cover both without rebuilding from a provider
    // listener during build.
    _seedFrom(ref.read(salonProfileProvider).value);
    // `listenManual` rather than `listen`: the declarative form is only valid
    // inside `build`, and this is a `ConsumerState`.
    _profileSubscription = ref.listenManual(
      salonProfileProvider,
      (_, next) => _seedFrom(next.value),
    );
  }

  ProviderSubscription<AsyncValue<SalonProfile>>? _profileSubscription;

  @override
  void dispose() {
    _profileSubscription?.close();
    _nameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _coverImageController.dispose();
    super.dispose();
  }

  void _seedFrom(SalonProfile? profile) {
    if (_seeded || profile == null) return;
    _seeded = true;
    _nameController.text = profile.name;
    _addressController.text = profile.address ?? '';
    // Shown with Persian digits like the rest of the UI; normalised on submit.
    _phoneController.text = toPersianDigits(profile.phone ?? '');
    _coverImageController.text = profile.coverImage ?? '';
  }

  /// An empty box means "leave this field alone" rather than "clear it": the
  /// backend drops falsy values, so it cannot be asked to blank a column.
  String? _orNull(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Grabbed before the await: after a successful save this screen is popped,
    // and the messenger of a disposed context cannot show anything.
    final messenger = ScaffoldMessenger.of(context);

    try {
      final status = await ref.read(salonEditControllerProvider.notifier).submitChanges(
            name: _nameController.text.trim(),
            address: _orNull(_addressController),
            // Persian and Arabic-Indic digits are what the keypad produces.
            phone: _orNull(_phoneController) == null
                ? null
                : toLatinDigits(_phoneController.text.trim()),
            coverImage: _orNull(_coverImageController),
          );
      if (!mounted) return;
      if (status == SalonApprovalStatus.pendingApproval) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('تغییرات شما برای بررسی به ادمین ارسال شد'),
            backgroundColor: BoyaColors.success,
          ),
        );
        // The controller has already invalidated the status and profile
        // providers, so the banner on the way back is correct.
        context.pop();
      }
    } catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            error is SalonEditNotQueuedException
                ? 'تغییرات شما ثبت نشد. لطفاً دوباره تلاش کنید.'
                : messageFromDio(error),
          ),
          backgroundColor: BoyaColors.error,
        ),
      );
    }
  }
  @override
  Widget build(BuildContext context) {
    final isSaving = ref.watch(salonEditControllerProvider).isLoading;

    return Scaffold(
      backgroundColor: BoyaColors.surface,
      appBar: const SalonAppBar(title: 'ویرایش اطلاعات سالن'),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // No retry action: the form is already open underneath this.
              const ApprovalStatusBanner(),
              Text('نام سالن', style: BoyaTypography.caption),
              const SizedBox(height: 4),
              TextFormField(
                controller: _nameController,
                textInputAction: TextInputAction.next,
                maxLength: 200,
                decoration: const InputDecoration(hintText: 'مثلاً آرایشی نگین', counterText: ''),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? 'نام سالن را وارد کنید' : null,
              ),
              const SizedBox(height: 16),
              Text('آدرس', style: BoyaTypography.caption),
              const SizedBox(height: 4),
              TextFormField(
                controller: _addressController,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: 'تهران، خیابان ولیعصر، پلاک ۱۲',
                  counterText: '',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),
              Text('تلفن', style: BoyaTypography.caption),
              const SizedBox(height: 4),
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                // A phone number is an LTR run even inside an RTL form.
                textDirection: TextDirection.ltr,
                maxLength: 15,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9۰-۹٠-٩]')),
                ],
                decoration: const InputDecoration(hintText: '09121234567', counterText: ''),
                validator: (value) {
                  final phone = toLatinDigits((value ?? '').trim());
                  if (phone.isEmpty) return null;
                  // `09xxxxxxxxx`, the shape every seeded and real number has.
                  return RegExp(r'^09\d{9}$').hasMatch(phone) ? null : 'شماره موبایل معتبر نیست';
                },
              ),
              const SizedBox(height: 16),
              Text('آدرس عکس کاور', style: BoyaTypography.caption),
              const SizedBox(height: 4),
              TextFormField(
                controller: _coverImageController,
                keyboardType: TextInputType.url,
                textDirection: TextDirection.ltr,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: 'https://example.com/cover.jpg',
                  counterText: '',
                ),
                validator: (value) {
                  final url = (value ?? '').trim();
                  if (url.isEmpty) return null;
                  final uri = Uri.tryParse(url);
                  final valid = uri != null &&
                      (uri.scheme == 'http' || uri.scheme == 'https') &&
                      uri.host.isNotEmpty;
                  return valid ? null : 'آدرس تصویر معتبر نیست';
                },
              ),
              const SizedBox(height: 8),
              Text(
                'آپلود مستقیم تصویر در فاز بعد فعال می‌شود؛ فعلاً آدرس تصویر را وارد کنید.',
                style: BoyaTypography.overline,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: isSaving ? null : _save,
                child: isSaving
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2, color: BoyaColors.white),
                      )
                    : const Text('ذخیره تغییرات'),
              ),
              const SizedBox(height: 8),
              Text(
                'تغییرات پس از تایید ادمین اعمال می‌شود.',
                style: BoyaTypography.overline,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}