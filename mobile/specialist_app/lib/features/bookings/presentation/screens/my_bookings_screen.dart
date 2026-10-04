import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

class MyBookingsScreen extends StatelessWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('نوبت‌های من')),
      body: const Center(child: Text('رزروی برای شما ثبت نشده', style: BoyaTypography.body)),
    );
  }
}
