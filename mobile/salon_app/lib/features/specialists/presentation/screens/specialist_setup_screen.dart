import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../auth/application/auth_controller.dart';
import '../../data/specialist_api.dart';
import '../../domain/salon_specialist.dart';

/// The signed-in specialist's own row. `GET /auth/me` reports the onboarding
/// flag but not the row id, and the setup form needs the id to PATCH it, so the
/// salon's specialist list is filtered on the auth user's id.
final mySpecialistProvider = FutureProvider.autoDispose<SalonSpecialist?>((ref) async {
  final userId = ref.watch(authControllerProvider).user?.id ?? '';
  return ref.watch(specialistApiProvider).mySpecialist(userId);
});

/// First-run profile setup for a specialist.
///
/// The router parks a signed-in specialist here while `profileCompleted` is
/// false — which is what an accepted invite leaves behind, since the invite
/// creates the `specialists` row but no profile. Saving PATCHes bio and skills
/// through the same `PATCH /salon/me/specialists/:id` the owner's specialist
/// tab uses; the backend stamps the onboarding flag there, and re-reading
/// `/auth/me` is what releases the router's gate.
class SpecialistSetupScreen extends ConsumerStatefulWidget {
  const SpecialistSetupScreen({super.key});

  @override
  ConsumerState<SpecialistSetupScreen> createState() => _SpecialistSetupScreenState();
}

class _SpecialistSetupScreenState extends ConsumerState<SpecialistSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _bioController = TextEditingController();
  final _skillController = TextEditingController();
  final List<String> _skills = [];
  bool _saving = false;

  @override
  void dispose() {
    _bioController.dispose();
    _skillController.dispose();
    super.dispose();
  }

  void _addSkill() {
    final value = _skillController.text.trim();
    if (value.isEmpty) return;
    setState(() {
      _skills.add(value);
      _skillController.clear();
    });
  }

  Future<void> _save(SalonSpecialist specialist) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Grabbed before the await: after a successful save this screen is gone,
    // and the messenger of a disposed context cannot show anything.
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);

    try {
      await ref.read(specialistApiProvider).updateSpecialist(
            specialist.id,
            bio: _bioController.text.trim(),
            skills: _skills,
          );
      // The flag lives on the live row, so this re-read — not the PATCH reply —
      // is what lets the router release this specialist into the panel.
      await ref.read(authControllerProvider.notifier).refreshUser();
      ref.invalidate(specialistListProvider);

      messenger.showSnackBar(
        const SnackBar(content: Text('پروفایل شما ثبت شد.'), backgroundColor: BoyaColors.success),
      );
      if (!mounted) return;
      context.go('/dashboard');
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

  Future<void> _logout() async {
    await ref.read(authControllerProvider.notifier).logout();
    if (!mounted) return;
    context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final mine = ref.watch(mySpecialistProvider);

    return Scaffold(
      // No back arrow and no home shortcut: this is a gate, not a page the user
      // can leave unfinished.
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('تکمیل پروفایل متخصص'),
      ),
      body: SafeArea(
        child: mine.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    messageFromDio(error),
                    style: BoyaTypography.body,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () => ref.invalidate(mySpecialistProvider),
                    child: const Text('تلاش دوباره'),
                  ),
                ],
              ),
            ),
          ),
          // No `specialists` row for this account: the user holds the
          // `specialist` role but the salon has not registered a row for them
          // (they were promoted before invites auto-created one). There is
          // nothing they can submit here, so the honest screen says so.
          data: (specialist) => specialist == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person_search, size: 64, color: BoyaColors.inkMuted),
                        const SizedBox(height: 24),
                        Text(
                          'هنوز پروفایل متخصصی برای شما در این سالن ثبت نشده است.',
                          style: BoyaTypography.headline,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'از مدیر سالن بخواهید شما را به‌عنوان متخصص دعوت کند تا پروفایل خود را تکمیل کنید.',
                          style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 32),
                        OutlinedButton(onPressed: _logout, child: const Text('خروج')),
                      ],
                    ),
                  ),
                )
              : _specialistForm(specialist),
        ),
      ),
    );
  }

  Widget _specialistForm(SalonSpecialist specialist) {
    final fullName = ref.watch(authControllerProvider).user?.fullName;

    return SingleChildScrollView(
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
              'برای ادامه، پروفایل متخصصی خود را تکمیل کنید. این اطلاعات در صفحهٔ شما دیده می‌شود.',
              style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
              textAlign: TextAlign.center,
            ),
            if (fullName != null && fullName.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text('نام: $fullName', style: BoyaTypography.body, textAlign: TextAlign.center),
            ],
            const SizedBox(height: 24),
            Text('بیوگرافی', style: BoyaTypography.caption),
            const SizedBox(height: 4),
            TextFormField(
              controller: _bioController,
              maxLines: 3,
              maxLength: 1000,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                hintText: 'مثلاً متخصص رنگ و مش با پنج سال سابقه',
                counterText: '',
                alignLabelWithHint: true,
              ),
              validator: (value) {
                final bio = (value ?? '').trim();
                if (bio.isEmpty) return 'یک توضیح کوتاه درباره خود وارد کنید';
                if (bio.length > 1000) return 'بیوگرافی طولانی است';
                return null;
              },
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
                    decoration: const InputDecoration(hintText: 'مثلاً رنگ', counterText: ''),
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
            if (_skills.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final skill in List<String>.of(_skills))
                    InputChip(
                      label: Text(skill),
                      onDeleted: () => setState(() => _skills.remove(skill)),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : () => _save(specialist),
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
    );
  }
}
