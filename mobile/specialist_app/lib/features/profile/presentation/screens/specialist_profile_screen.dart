import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

class SpecialistProfileScreen extends StatelessWidget {
  const SpecialistProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('پروفایل')),
      body: const Center(child: Text('نام و شماره پس از ورود نمایش داده می‌شود', style: BoyaTypography.body)),
    );
  }
}
