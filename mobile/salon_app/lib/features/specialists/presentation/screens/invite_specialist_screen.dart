import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../data/invite_api.dart';
import '../../domain/specialist_form.dart';

/// Invite a specialist (or a line manager) to join the signed-in salon.
///
/// The salon panel's other door — `POST /salon/me/specialists` — mints the
/// account immediately from a phone the owner typed, which means the person on
/// the other end never proves the number is theirs. This screen is the invite
/// door (ADR-010): the owner names a phone, the backend stores a hashed token,
/// and the invitee redeems it with an OTP before any account exists. The
/// plaintext token is shown exactly once, so the screen swaps to a result view
/// with a copy button instead of popping straight back.
///
/// The tenant is never asked for: the backend reads it from the JWT, so a
/// `salon_owner` can only ever invite into their own salon.
class InviteSpecialistScreen extends ConsumerStatefulWidget {
  const InviteSpecialistScreen({super.key});

  @override
  ConsumerState<InviteSpecialistScreen> createState() => _InviteSpecialistScreenState();
}

class _InviteSpecialistScreenState extends ConsumerState<InviteSpecialistScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();

  /// Reused for its phone normalisation and validation, which mirror
  /// `normalizePhone` on the backend.
  final _form = SpecialistForm();

  String _role = specialistInviteRoleOptions.first.value;
  bool _sending = false;

  /// Non-null once an invite has been issued; switches the body to the result.
  IssuedInvite? _issued;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final messenger = ScaffoldMessenger.of(context);
    _form.phone = _phoneController.text;
    setState(() => _sending = true);
    try {
      final invite = await ref.read(inviteApiProvider).inviteSpecialist(
            phone: _form.normalisedPhone,
            role: _role,
          );
      if (!mounted) return;
      setState(() {
        _sending = false;
        _issued = invite;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _sending = false);
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  Future<void> _copyToken() async {
    final token = _issued?.token;
    if (token == null || token.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: token));
    messenger.showSnackBar(const SnackBar(content: Text('توکن کپی شد')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SalonAppBar(title: 'دعوت متخصص'),
      body: SafeArea(
        child: _issued == null ? _buildForm() : _buildResult(_issued!),
      ),
    );
  }

  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'با ثبت شماره موبایل، یک لینک دعوت یک‌بارمصرف ساخته می‌شود. '
            'دعوت‌شده با تأیید کد پیامک‌شده به این سالن می‌پیوندد.',
            style: BoyaTypography.caption,
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
            validator: (_) {
              _form.phone = _phoneController.text;
              return _form.validatePhone();
            },
          ),
          const SizedBox(height: 16),
          Text('نقش', style: BoyaTypography.caption),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final option in specialistInviteRoleOptions)
                ChoiceChip(
                  label: Text(option.label),
                  selected: _role == option.value,
                  onSelected: _sending
                      ? null
                      : (_) => setState(() => _role = option.value),
                ),
            ],
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _sending ? null : _submit,
            child: _sending
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: BoyaColors.white,
                    ),
                  )
                : const Text('ارسال دعوت'),
          ),
        ],
      ),
    );
  }

  Widget _buildResult(IssuedInvite invite) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Icon(Icons.check_circle_outline, color: BoyaColors.success),
            const SizedBox(width: 8),
            Text('دعوت‌نامه ساخته شد', style: BoyaTypography.body),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          'این توکن فقط همین یک‌بار نمایش داده می‌شود. آن را برای دعوت‌شده بفرستید؛ '
          'در سرور تنها هش آن ذخیره شده و بازیابی ممکن نیست.',
          style: BoyaTypography.caption,
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: BoyaColors.primarySubtle,
            borderRadius: BorderRadius.circular(12),
          ),
          child: SelectableText(
            invite.token,
            style: BoyaTypography.caption.copyWith(letterSpacing: 0.5),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _copyToken,
          icon: const Icon(Icons.copy),
          label: const Text('کپی توکن'),
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('بازگشت به فهرست متخصصان'),
        ),
      ],
    );
  }
}
