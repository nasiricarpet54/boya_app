import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:boya_shared/boya_shared.dart';
import 'router.dart';

void main() {
  runApp(
    const ProviderScope(
      child: BoyaSpecialistApp(),
    ),
  );
}

class BoyaSpecialistApp extends ConsumerWidget {
  const BoyaSpecialistApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goRouter = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Boya Specialist',
      theme: BoyaTheme.light(),
      routerConfig: goRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}
