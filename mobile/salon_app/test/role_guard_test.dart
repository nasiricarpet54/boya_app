import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:salon_app/core/router/app_router.dart';
import 'package:salon_app/features/auth/application/auth_controller.dart';
import 'package:salon_app/features/auth/domain/salon_user.dart';

/// A controller that reports a fixed session instead of reading
/// SharedPreferences, so the router can be driven from a test.
class _FakeAuthController extends AuthController {
  _FakeAuthController(this.session);

  final AuthState session;

  @override
  AuthState build() => session;
}

/// Pumps the real router with [session] installed, navigates to [startAt] and
/// reports the location it settled on.
///
/// Frames are pumped a bounded number of times rather than with
/// `pumpAndSettle`: the dashboard shows a `CircularProgressIndicator` that never
/// stops animating, so settling would time out even though the redirect has
/// already been decided.
Future<String> _settleLocation(
  WidgetTester tester,
  AuthState session, {
  String startAt = '/dashboard',
}) async {
  late GoRouter router;

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider
            .overrideWith(() => _FakeAuthController(session)),
      ],
      child: Consumer(
        builder: (context, ref, child) {
          router = ref.read(appRouterProvider);
          return MaterialApp.router(routerConfig: router);
        },
      ),
    ),
  );

  // The router is built with `initialLocation: '/auth/login'`, so reaching any
  // other route has to be an explicit navigation.
  router.go(startAt);
  for (var i = 0; i < 4; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }

  return router.routerDelegate.currentConfiguration.uri.path;
}

AuthState _signedIn(String role, {bool profileCompleted = true}) => AuthState(
      user: SalonUser(
        id: 'u1',
        phoneNumber: '09120000000',
        role: role,
        profileCompleted: profileCompleted,
      ),
      token: 'token',
    );

const AuthState _signedOut = AuthState();

void main() {
  group('hasSalonAccess', () {
    test('admits every staff role the backend panel serves', () {
      // Keep in step with STAFF_ROLES in backend/src/modules/salon/salon.service.ts.
      expect(hasSalonAccess('salon_owner'), isTrue);
      expect(hasSalonAccess('line_manager'), isTrue);
      expect(hasSalonAccess('specialist'), isTrue);
      expect(hasSalonAccess('admin'), isTrue);
    });

    test('refuses a customer account', () {
      expect(hasSalonAccess('customer'), isFalse);
    });

    test('fails closed for null, blank and unknown roles', () {
      // A role the backend adds later must not silently inherit panel access.
      expect(hasSalonAccess(null), isFalse);
      expect(hasSalonAccess(''), isFalse);
      expect(hasSalonAccess('superuser'), isFalse);
      expect(hasSalonAccess('Salon_Owner'), isFalse);
    });

    test('SalonUser.hasSalonAccess agrees with the top-level helper', () {
      for (final role in ['salon_owner', 'line_manager', 'specialist', 'admin']) {
        expect(
          SalonUser(id: 'u', phoneNumber: '09120000000', role: role).hasSalonAccess,
          hasSalonAccess(role),
        );
      }
      expect(
        const SalonUser(id: 'u', phoneNumber: '09120000000', role: 'customer').hasSalonAccess,
        isFalse,
      );
    });
  });

  group('router redirect', () {
    testWidgets('an unauthenticated visitor is sent to the login screen',
        (tester) async {
      expect(await _settleLocation(tester, _signedOut), '/auth/login');
    });

    testWidgets('a signed-in customer is sent to the forbidden screen',
        (tester) async {
      expect(await _settleLocation(tester, _signedIn('customer')), '/auth/forbidden');
    });

    testWidgets('an unknown role fails closed to the forbidden screen',
        (tester) async {
      expect(await _settleLocation(tester, _signedIn('superuser')), '/auth/forbidden');
    });

    testWidgets('a salon owner keeps the normal path', (tester) async {
      expect(await _settleLocation(tester, _signedIn('salon_owner')), '/dashboard');
    });

    testWidgets('a line manager keeps the normal path', (tester) async {
      expect(await _settleLocation(tester, _signedIn('line_manager')), '/dashboard');
    });

    testWidgets('a specialist keeps the normal path', (tester) async {
      // Specialists are panel staff: APPROVER_ROLES/STAFF_ROLES include them and
      // the API scopes their bookings. Blocking them here would break approvals.
      expect(await _settleLocation(tester, _signedIn('specialist')), '/dashboard');
    });

    testWidgets('an admin keeps the normal path', (tester) async {
      expect(await _settleLocation(tester, _signedIn('admin')), '/dashboard');
    });

    testWidgets('the forbidden page does not redirect into a loop',
        (tester) async {
      expect(
        await _settleLocation(tester, _signedIn('customer'), startAt: forbiddenPath),
        '/auth/forbidden',
      );
    });

    testWidgets('an allowed user is bounced off the forbidden page',
        (tester) async {
      expect(
        await _settleLocation(tester, _signedIn('salon_owner'), startAt: forbiddenPath),
        '/dashboard',
      );
    });

    testWidgets('an allowed user is bounced off the login page',
        (tester) async {
      expect(
        await _settleLocation(tester, _signedIn('salon_owner'), startAt: '/auth/login'),
        '/dashboard',
      );
    });

    testWidgets('a signed-out visitor on the forbidden page stays put',
        (tester) async {
      // The token can expire while the forbidden screen is open; landing on the
      // login screen from there is correct, not a loop.
      expect(await _settleLocation(tester, _signedOut, startAt: forbiddenPath), '/auth/forbidden');
    });

    testWidgets('an owner with an incomplete profile is sent to the salon setup screen',
        (tester) async {
      expect(
        await _settleLocation(tester, _signedIn('salon_owner', profileCompleted: false)),
        salonSetupPath,
      );
    });

    testWidgets('a line manager with an incomplete profile is sent to the salon setup screen',
        (tester) async {
      expect(
        await _settleLocation(tester, _signedIn('line_manager', profileCompleted: false)),
        salonSetupPath,
      );
    });

    testWidgets('a specialist with an incomplete profile is sent to their own setup screen',
        (tester) async {
      // The specialist completes a different row (their own `specialists` row,
      // not the salon's), so their gate has its own target.
      expect(
        await _settleLocation(tester, _signedIn('specialist', profileCompleted: false)),
        specialistSetupPath,
      );
    });

    testWidgets('the setup screen does not redirect into a loop', (tester) async {
      expect(
        await _settleLocation(
          tester,
          _signedIn('salon_owner', profileCompleted: false),
          startAt: salonSetupPath,
        ),
        salonSetupPath,
      );
    });

    testWidgets('an incomplete specialist on the salon setup path is moved to their own',
        (tester) async {
      expect(
        await _settleLocation(
          tester,
          _signedIn('specialist', profileCompleted: false),
          startAt: salonSetupPath,
        ),
        specialistSetupPath,
      );
    });

    testWidgets('an incomplete owner on the specialist setup path is moved to the salon one',
        (tester) async {
      expect(
        await _settleLocation(
          tester,
          _signedIn('salon_owner', profileCompleted: false),
          startAt: specialistSetupPath,
        ),
        salonSetupPath,
      );
    });

    testWidgets('a specialist who completed onboarding reaches the dashboard',
        (tester) async {
      expect(
        await _settleLocation(tester, _signedIn('specialist', profileCompleted: true)),
        '/dashboard',
      );
    });
  });

  group('SalonUser.profileCompleted', () {
    test('is read from the /auth/me payload', () {
      const user = SalonUser(
        id: 'u',
        phoneNumber: '09120000000',
        role: 'salon_owner',
        profileCompleted: false,
      );
      expect(user.profileCompleted, isFalse);
    });

    test('fromJson defaults to true when the field is absent', () {
      // Fail open: a legacy cached session cannot reach /auth/me must not be
      // parked on the setup screen. The server re-reads the flag on restore.
      final parsed = SalonUser.fromJson(const {
        'id': 'u',
        'phoneNumber': '09120000000',
        'role': 'salon_owner',
      });
      expect(parsed.profileCompleted, isTrue);
    });

    test('fromJson reads an explicit false', () {
      final parsed = SalonUser.fromJson(const {
        'id': 'u',
        'phoneNumber': '09120000000',
        'role': 'specialist',
        'profileCompleted': false,
      });
      expect(parsed.profileCompleted, isFalse);
    });

    test('round-trips through toJson', () {
      const user = SalonUser(
        id: 'u',
        phoneNumber: '09120000000',
        role: 'specialist',
        profileCompleted: false,
      );
      final reparsed = SalonUser.fromJson(user.toJson());
      expect(reparsed.profileCompleted, isFalse);
    });
  });
}