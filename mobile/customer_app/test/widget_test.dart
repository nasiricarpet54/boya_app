import 'package:customer_app/features/home/application/home_providers.dart';
import 'package:customer_app/features/home/domain/salon_summary.dart';
import 'package:customer_app/features/home/domain/service_category.dart';
import 'package:customer_app/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Boots the real router with an empty catalogue so no network call is made.
void main() {
  testWidgets('customer app boots to the Persian home feed', (tester) async {
    // The auth controller restores the cached session from disk on build; with
    // no in-memory store the plugin channel never answers and the splash would
    // never settle. An empty store means "signed out", which is what the router
    // needs to fall through to /home.
    SharedPreferences.setMockInitialValues(<String, Object>{});

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          nearbySalonsProvider.overrideWith((ref) async => const <SalonSummary>[]),
          homeCategoriesProvider.overrideWith((ref) async => const <ServiceCategory>[]),
        ],
        child: const CustomerApp(),
      ),
    );
    await tester.pumpAndSettle();

    // The header stack (top bar, search, categories, promo, chips) is taller
    // than the 600px test viewport, so the salon section starts below the fold:
    // scroll down the way a customer would before asserting on it.
    await tester.drag(find.byType(ListView).first, const Offset(0, -400));
    await tester.pumpAndSettle();

    expect(find.text('سالن‌های اطراف شما'), findsOneWidget);
    expect(find.text('۲۰٪ تخفیف اولین رزرو'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('سالن‌های اطراف شما'))),
      TextDirection.rtl,
    );
  });
}


