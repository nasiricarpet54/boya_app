import 'package:boya_shared/boya_shared.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';

/// Root provider container, held outside the widget tree so that the router's
/// [GoRouter.redirect] can read auth state before the first screen is built.
ProviderContainer globalProviderContainer = ProviderContainer();

void main() {
  runApp(UncontrolledProviderScope(container: globalProviderContainer, child: const SalonApp()));
}

class SalonApp extends ConsumerWidget {
  const SalonApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'بویا سالن',
      debugShowCheckedModeBanner: false,
      theme: BoyaTheme.light(),
      darkTheme: BoyaTheme.dark(),
      locale: const Locale('fa', 'IR'),
      supportedLocales: const [Locale('fa', 'IR'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => rtl(child ?? const SizedBox.shrink()),
      routerConfig: ref.watch(appRouterProvider),
    );
  }
}