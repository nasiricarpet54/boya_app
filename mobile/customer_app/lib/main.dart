import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:boya_shared/boya_shared.dart';
import 'router.dart';

void main() {
  runApp(
    const ProviderScope(
      child: BoyaCustomerApp(),
    ),
  );
}

class BoyaCustomerApp extends ConsumerWidget {
  const BoyaCustomerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goRouter = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Boya',
      theme: BoyaTheme.lightTheme,
      routerConfig: goRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}
