import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:boya_shared/boya_shared.dart';

void main() {
  runApp(
    const ProviderScope(
      child: BoyaSalonApp(),
    ),
  );
}

class BoyaSalonApp extends ConsumerWidget {
  const BoyaSalonApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Boya Salon',
      theme: BoyaTheme.lightTheme,
      home: const SalonHome(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class SalonHome extends StatelessWidget {
  const SalonHome({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Boya Salon App')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Accounting Flow Stub', style: Theme.of(context).textTheme.displayLarge),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {},
              child: const Text('Multi-session Cards Placeholder'),
            ),
          ],
        ),
      ),
    );
  }
}
