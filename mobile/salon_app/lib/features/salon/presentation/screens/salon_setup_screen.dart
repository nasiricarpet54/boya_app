import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/salon_edit_controller.dart';
import '../../data/salon_api.dart';
import '../../domain/salon_profile.dart';

/// First-run profile setup for a salon owner (or line manager).
///
/// The router parks a signed-in user here while `profileCompleted` is false
/// (migration 1730000000033 + `GET /auth/me`). Saving submits the same
/// approval-gated `PATCH /salon/me` the profile tab uses — nothing here becomes
/// public until an admin approves it — but the backend stamps the onboarding
/// flag on the *live* row immediately, so this screen is the one door that lets
/// the owner out of setup and into the panel. Re-reading `/auth/me` afterwards
/// is what releases the router's gate.
class SalonSetupScreen extends ConsumerStatefulWidget {
  const SalonSetupScreen({super.key});

  @override
  ConsumerState<SalonSetupScreen> createState() => _SalonSetupScreenState();
}

class _SalonSetupScreenState extends ConsumerState<SalonSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();

  /// Seeded once, like the edit form: a rebuild following the save must never
  /// overwrite what the user is typing.
  bool _seeded = false;
  bool _saving = false;

  /// `listenManual` rather than `listen`: the declarative form is only valid
  /// inside `build`, and this is a `ConsumerState`.
  ProviderSubscription<AsyncValue<SalonProfile>>? _profileSubscription;

  @override
  void initState() {
    super.initState();
    _seedFrom(ref.read(salonProfileProvider).value);
    _profileSubscription = ref.listenManual(
      salonProfileProvider,
      (_, next) => _seedFrom(next.value),
    );
  }

  @override
  void dispose() {
    _profileSubscription?.close();
    _nameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _seedFrom(SalonProfile? profile) {
    if (_seeded || profile == null) return;
    _seeded = true;
    _nameController.text = profile.name;
    _addressController.text = profile.address ?? '';
    _phoneController.text = toPersianDigits(profile.phone ?? '');
  }

  /// An empty box means "leave this field alone", matching the edit form: the
  /// backend drops falsy values, so it cannot be asked to blank a column.
  String? _orNull(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Grabbed before the await: after a successful save this screen is gone,
    // and the messenger of a disposed context cannot show anything.
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);

    try {
      await ref.read(salonEditControllerProvider.notifier).submitChanges(
            name: _nameController.text.trim(),
            address: _orNull(_addressController),
            // Persian and Arabic-Indic digits are what the keypad produces.
            phone: _orNull(_phoneController) == null
                ? null
                : toLatinDigits(_phoneController.text.trim()),
          );
      // The flag lives on the live row, so this re-read — not the PATCH reply —
      // is what lets the router release this user into the panel.
      await ref.read(authControllerProvider.notifier).refreshUser();

      messenger.showSnackBar(
        const SnackBar(
          content: Text('پروفایل سالن ثبت شد و برای بررسی ارسال شد.'),
          backgroundColor: BoyaColors.success,
        ),
      );
      if (!mounted) return;
      context.go('/dashboard');
    } on SalonEditNotQueuedException {
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text('ذخیره انجام نشد. دوباره تلاش کنید.'),
          backgroundColor: BoyaColors.error,
        ),
      );
      setState(() => _saving = false);
    } catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(messageFromDio(error)),
          backgroundColor: BoyaColors.error,
        ),
      );
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // No back arrow and no home shortcut: this is a gate, not a page the user
      // can leave unfinished.
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('تکمیل پروفایل سالن'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'به سالن خود خوش آمدید!',
                  style: BoyaTypography.headline,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'برای ادامه، اطلاعات اولیهٔ سالن را تکمیل کنید. نام و آدرس پس از تأیید ادمین در ویترین عمومی نمایش داده می‌شوند، اما تکمیل این فرم ثبت می‌شود و می‌توانید وارد پنل شوید.',
                  style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Text('نام سالن', style: BoyaTypography.caption),
                const SizedBox(height: 4),
                TextFormField(
                  controller: _nameController,
                  maxLength: 200,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    hintText: 'مثلاً سالن زیبایی رؤیا',
                    counterText: '',
                  ),
                  validator: (value) {
                    final name = (value ?? '').trim();
                    if (name.isEmpty) return 'نام سالن را وارد کنید';
                    if (name.length > 200) return 'نام سالن طولانی است';
                    return null;
                  },
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
                    return RegExp(r'^09\d{9}$').hasMatch(phone) ? null : 'شماره موبایل معتبر نیست';
                  },
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
                      : const Text('ثبت و ورود به پنل'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
