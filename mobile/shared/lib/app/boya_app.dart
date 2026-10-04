import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:parsi_datetime_picker/parsi_datetime_picker.dart';

import '../theme/boya_theme.dart';
import '../utils/text_direction_utils.dart';

/// Persian locale and RTL delegates shared by every BOYA app.
abstract final class BoyaLocalization {
  static const Locale locale = Locale('fa', 'IR');

  static const List<Locale> supportedLocales = [
    Locale('fa', 'IR'),
    Locale('en', 'US'),
  ];

  static const List<LocalizationsDelegate<dynamic>> delegates = [
    ...parsiLocalizationsDelegates,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ];
}

/// Wraps [MaterialApp] so customer, salon, and specialist stay on one setup.
Widget boyaMaterialApp({
  required String title,
  required Widget home,
  ThemeMode themeMode = ThemeMode.light,
}) {
  return MaterialApp(
    title: title,
    debugShowCheckedModeBanner: false,
    theme: BoyaTheme.light(),
    darkTheme: BoyaTheme.dark(),
    themeMode: themeMode,
    locale: BoyaLocalization.locale,
    supportedLocales: BoyaLocalization.supportedLocales,
    localizationsDelegates: BoyaLocalization.delegates,
    builder: (context, child) => rtl(child ?? const SizedBox.shrink()),
    home: home,
  );
}
