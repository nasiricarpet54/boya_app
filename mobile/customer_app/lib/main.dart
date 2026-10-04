import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/application/auth_controller.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/otp_screen.dart';
import 'features/booking/presentation/screens/booking_screen.dart';
import 'features/booking/presentation/screens/booking_success_screen.dart';
import 'features/home/presentation/screens/home_screen.dart';
import 'features/home/presentation/screens/search_screen.dart';
import 'features/notifications/presentation/screens/notifications_screen.dart';
import 'features/profile/presentation/screens/booking_history_screen.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'features/salon/presentation/screens/salon_detail_screen.dart';
import 'shared/widgets/placeholder_screen.dart';

/// Held outside the widget tree so the router's [GoRouter.redirect] can read
/// auth state. `ProviderScope` cannot expose a container to a top-level final,
/// and the guard must work before the first screen is built.
ProviderContainer? _globalProviderContainer;

void main() {
  final container = ProviderContainer();
  _globalProviderContainer = container;
  runApp(UncontrolledProviderScope(container: container, child: const CustomerApp()));
}

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'بویا',
      debugShowCheckedModeBanner: false,
      theme: BoyaTheme.light(),
      darkTheme: BoyaTheme.dark(),
      locale: BoyaLocalization.locale,
      supportedLocales: BoyaLocalization.supportedLocales,
      localizationsDelegates: BoyaLocalization.delegates,
      builder: (context, child) => rtl(child ?? const SizedBox.shrink()),
      routerConfig: _router,
    );
  }
}

final _router = GoRouter(
  initialLocation: '/home',
  routes: [
    GoRoute(path: '/auth/login', builder: (_, _) => const LoginScreen()),
    GoRoute(
      path: '/auth/otp',
      builder: (_, state) => OtpScreen(phone: state.extra as String? ?? ''),
    ),
    GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
    GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
    GoRoute(
      path: '/salon/:salonId',
      builder: (_, state) => SalonDetailScreen(salonId: state.pathParameters['salonId']!),
    ),
    GoRoute(
      path: '/salon/:salonId/booking',
      builder: (_, state) => BookingScreen(salonId: state.pathParameters['salonId']!),
    ),
    // Phase 1 bookings end here: no gateway, the salon approves and the bill
    // is settled on site.
    GoRoute(path: '/booking/success', builder: (_, _) => const BookingSuccessScreen()),
    GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    GoRoute(path: '/profile/bookings', builder: (_, _) => const BookingHistoryScreen()),
    // Notification targets. Referral rewards and loyalty points are named as
    // tap destinations, so both routes exist to keep a tap off a dead path.
    GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
    GoRoute(
      path: '/referral',
      builder: (_, _) => const PlaceholderScreen(title: 'معرفی دوستان'),
    ),
    GoRoute(
      path: '/loyalty',
      builder: (_, _) => const PlaceholderScreen(title: 'امتیاز وفاداری'),
    ),
  ],
  redirect: (context, state) {
    final container = _globalProviderContainer;
    // Before main() has run there is no state to read; let the route through.
    if (container == null) return null;
    final auth = container.read(authControllerProvider);
    // While the cached session is being read we cannot know yet, so hold the
    // redirect rather than bouncing a signed-in user to the login screen.
    if (auth.isRestoring) return null;

    final requiresAuth = _protectedPaths.any(state.matchedLocation.startsWith);
    if (requiresAuth && !auth.isAuthenticated) {
      return Uri(path: '/auth/login', queryParameters: {'returnTo': state.matchedLocation}).toString();
    }
    return null;
  },
);

/// Routes that need a session. Everything else — home, search, salon detail —
/// stays public so the catalogue can be browsed before signing in. The bell
/// stays visible while signed out and simply carries no badge.
const _protectedPaths = ['/profile', '/profile/bookings', '/notifications', '/referral', '/loyalty'];
