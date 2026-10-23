import 'dart:async';

import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/auth_controller.dart';
import '../../../../core/network/api_client.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({required this.phone, super.key});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _codeController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  Timer? _timer;
  int _secondsLeft = 120;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft == 0) {
        timer.cancel();
      } else if (mounted) {
        setState(() => _secondsLeft -= 1);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (!_formKey.currentState!.validate()) return;
    final code = toLatinDigits(_codeController.text.trim());
    try {
      await ref.read(authControllerProvider.notifier).verifyOtp(
        phoneNumber: widget.phone,
        code: code,
      );
      if (mounted) context.go('/dashboard');
    } on SalonAccessDeniedException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('این حساب دسترسی ندارد'), backgroundColor: BoyaColors.error),
      );
      context.go('/auth/login');
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
    final minutes = toPersianDigits(_secondsLeft ~/ 60);
    final seconds = toPersianDigits((_secondsLeft % 60).toString().padLeft(2, '0'));
    return Scaffold(
      backgroundColor: BoyaColors.surface,
      appBar: AppBar(title: const Text('کد تأیید')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('کد شش‌رقمی پیامک‌شده را وارد کنید', style: BoyaTypography.body, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(
                  toPersianDigits(widget.phone),
                  style: BoyaTypography.title.copyWith(color: BoyaColors.primary),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _codeController,
                  keyboardType: TextInputType.number,
                  textDirection: TextDirection.ltr,
                  textAlign: TextAlign.center,
                  maxLength: 6,
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9۰-۹٠-٩]'))],
                  style: BoyaTypography.headline.copyWith(letterSpacing: 8),
                  decoration: const InputDecoration(labelText: 'کد تأیید', counterText: '', hintText: '۱۲۳۴۵۶'),
                  onFieldSubmitted: (_) => _verify(),
                  validator: (value) {
                    final code = toLatinDigits((value ?? '').trim());
                    if (!RegExp(r'^[0-9]{6}$').hasMatch(code)) return 'کد وارد شده صحیح نیست';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                Text(
                  _secondsLeft == 0 ? 'کد منقضی شد' : 'زمان باقی‌مانده: $minutes:$seconds',
                  style: BoyaTypography.caption,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: loading || _secondsLeft == 0 ? null : _verify,
                  child: loading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: BoyaColors.white),
                        )
                      : const Text('تأیید'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}