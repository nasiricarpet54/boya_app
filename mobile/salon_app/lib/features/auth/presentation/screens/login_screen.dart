import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../application/auth_controller.dart';
import '../../../../core/network/api_client.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (!_formKey.currentState!.validate()) return;
    final phone = toLatinDigits(_phoneController.text.trim());
    try {
      await ref.read(authControllerProvider.notifier).sendOtp(phone);
      if (mounted) context.push('/auth/otp', extra: phone);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(messageFromDio(error)), backgroundColor: BoyaColors.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authControllerProvider).isLoading;
    return Scaffold(
      backgroundColor: BoyaColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 40),
                const Center(child: BoyaLogo(size: 80)),
                const SizedBox(height: 24),
                Text('خوش آمدید به پنل سالن بویا', style: BoyaTypography.headline, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(
                  'برای مدیریت سالن، شماره موبایل خود را وارد کنید',
                  style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textDirection: TextDirection.ltr,
                  textAlign: TextAlign.left,
                  maxLength: 11,
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9۰-۹٠-٩]'))],
                  style: BoyaTypography.body.copyWith(fontSize: 18, letterSpacing: 2),
                  decoration: const InputDecoration(
                    labelText: 'شماره موبایل',
                    hintText: '۰۹۱۲۳۴۵۶۷۸۹',
                    prefixIcon: Icon(Icons.phone_android, color: BoyaColors.primary),
                    counterText: '',
                  ),
                  validator: (value) {
                    final normalized = toLatinDigits((value ?? '').trim());
                    if (normalized.isEmpty) return 'لطفاً شماره موبایل را وارد کنید';
                    if (!RegExp(r'^09[0-9]{9}$').hasMatch(normalized)) {
                      return 'شماره موبایل وارد شده معتبر نیست';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: loading ? null : _sendOtp,
                  child: loading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: BoyaColors.white),
                        )
                      : const Text('دریافت کد تأیید'),
                ),
                const SizedBox(height: 24),
                Text(
                  'با ورود به پنل سالن بویا،شرایط استفاده و سیاست حریم خصوصی را می‌پذیرم',
                  style: BoyaTypography.overline,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}