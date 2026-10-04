import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shared shell is Persian and RTL', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: BoyaLocalization.locale,
        supportedLocales: BoyaLocalization.supportedLocales,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => rtl(child ?? const SizedBox.shrink()),
        home: const Scaffold(body: Center(child: Text('بویا'))),
      ),
    );
    await tester.pumpAndSettle();

    final context = tester.element(find.text('بویا'));
    expect(Directionality.of(context), TextDirection.rtl);
    expect(Localizations.localeOf(context).languageCode, 'fa');
  });
}
