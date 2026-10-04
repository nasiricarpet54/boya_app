import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// Placeholder for a screen the router already points at but that is not built
/// yet. Referral rewards and loyalty points are named as notification targets,
/// so the routes exist to keep a tap from landing on a dead path; replacing the
/// body is the only change a finished screen needs.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({required this.title, super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title, style: BoyaTypography.title), centerTitle: true),
      body: const Center(child: Text('این بخش به‌زودی در دسترس قرار می‌گیرد', style: BoyaTypography.body)),
    );
  }
}