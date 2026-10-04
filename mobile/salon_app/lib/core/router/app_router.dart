import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/bookings/screens/booking_detail_screen.dart';
import '../../features/bookings/screens/bookings_list_screen.dart';
import '../../features/bookings/presentation/screens/salon_calendar_view.dart';
import '../../features/dashboard/presentation/screens/salon_dashboard_screen.dart';
import '../../features/finance/presentation/screens/salon_financial_screen.dart';
import '../../features/portfolio/presentation/screens/portfolio_manage_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/salon/presentation/screens/salon_edit_screen.dart';
import '../../features/services/presentation/screens/line_form_screen.dart';
import '../../features/services/presentation/screens/lines_list_screen.dart';
import '../../features/services/presentation/screens/service_form_screen.dart';
import '../../features/services/presentation/screens/services_list_screen.dart';
import '../../features/specialists/presentation/screens/specialist_form_screen.dart';
import '../../features/specialists/presentation/screens/specialist_list_screen.dart';
import '../navigation/salon_shell.dart';

/// The salon profile form. Lives outside the shell on purpose: it is a full
/// page reached from the profile tab, not a sixth tab of its own, so it is
/// pushed onto the root navigator and takes the whole screen.
const String salonEditPath = '/salon/edit';

/// Service-line management paths. Like the edit form, they are full-page
/// screens pushed onto the root navigator rather than a tab of their own.
const String serviceLinesPath = '/services/lines';
const String serviceLineCreatePath = '/services/lines/new';

String lineEditPath(String id) => '/services/lines/$id/edit';
String lineServicesPath(String lineId) => '/services/lines/$lineId/services';
String serviceCreatePath(String lineId) => '/services/lines/$lineId/services/new';
String serviceEditPath(String id) => '/services/services/$id/edit';

/// Specialist management paths. The list is the shell's «متخصصان» tab
/// (`specialistsPath`); the create and edit forms are full-page screens
/// pushed onto the root navigator like the service-line forms, and the
/// portfolio screen is reached from the profile menu.
const String specialistsPath = '/specialists';
const String specialistCreatePath = '/specialists/new';
const String portfolioPath = '/portfolio';

String specialistEditPath(String id) => '/specialists/$id/edit';

/// Booking management paths.
///
/// The list is the shell's «رزروها» tab. The calendar lives beside it in the
/// same branch so the tab keeps its state while switching views, and the
/// detail screen is a full page pushed onto the root navigator — like the
/// specialist and service forms, it is reached by tapping a row and takes the
/// whole screen rather than being a tab of its own.
const String bookingsCalendarPath = '/bookings/calendar';

String bookingDetailPath(String id) => '/bookings/$id';

/// The calendar's day hand-off: the list screen, pre-filtered to one day.
///
/// The day travels as a query parameter rather than the calendar's own
/// `DateTime`, because the list sends it to the backend as `YYYY-MM-DD` and
/// the router is where a screen-to-screen argument becomes one canonical
/// value. `date` is kept in the app's own timezone, which is what the Tehran
/// day boundary the backend applies expects.
String bookingsCalendarListPath(DateTime day) => '/bookings?date=${day.toString().split(' ').first}';

/// Re-evaluates the redirect guard whenever auth state changes, so a session
/// restored from disk on cold start can bounce an authenticated user off the
/// login screen onto the dashboard.
class _AuthRouterRefresh extends ChangeNotifier {
  void refresh() => notifyListeners();
}

/// App-wide router. Read once by [SalonApp]; the guard reads auth state from
/// the provider tree on every navigation.
///
/// The five authenticated screens live inside one [StatefulShellRoute], which
/// is what gives them the shared bottom navigation bar while keeping each
/// tab's own navigation stack alive.
final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRouterRefresh();
  ref.listen(authControllerProvider, (_, _) => refresh.refresh());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    refreshListenable: refresh,
    initialLocation: '/auth/login',
    routes: [
      GoRoute(path: '/auth/login', builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: '/auth/otp',
        builder: (_, state) => OtpScreen(phone: state.extra as String? ?? ''),
      ),
      // Sibling of the shell rather than a branch of it: the form takes over
      // the whole screen, bottom navigation bar included. The auth redirect
      // below still applies — only the path prefix is checked.
      GoRoute(path: salonEditPath, builder: (_, _) => const SalonEditScreen()),
      // Service-line management. Also outside the shell: every one of these is
      // a pushed full-page screen reached from the profile tab, and the auth
      // redirect below matches on the `/services` prefix already.
      GoRoute(
        path: serviceLinesPath,
        builder: (_, _) => const LinesListScreen(),
      ),
      // Declared before `/services/lines/:id/edit` so the literal `new` segment
      // is not swallowed by the `:id` parameter.
      GoRoute(
        path: serviceLineCreatePath,
        builder: (_, _) => const LineFormScreen(),
      ),
      GoRoute(
        path: '/services/lines/:id/edit',
        builder: (_, state) => const LineFormScreen(),
      ),
      GoRoute(
        path: '/services/lines/:lineId/services',
        builder: (_, state) => ServicesListScreen(lineId: state.pathParameters['lineId']!),
      ),
      GoRoute(
        path: '/services/lines/:lineId/services/new',
        builder: (_, state) => const ServiceFormScreen(),
      ),
      GoRoute(
        path: '/services/services/:id/edit',
        builder: (_, state) => const ServiceFormScreen(),
      ),
      // Specialist management and the portfolio screen: also outside the
      // shell, full-page screens reached from the «متخصصان» tab and the
      // profile menu. The literal `new` segment is declared before
      // `/specialists/:id/edit` so it is not swallowed by the `:id`
      // parameter, matching how the service-line forms are ordered.
      GoRoute(
        path: portfolioPath,
        builder: (_, _) => const PortfolioManageScreen(),
      ),
      GoRoute(
        path: specialistCreatePath,
        builder: (_, _) => const SpecialistFormScreen(),
      ),
      GoRoute(
        path: '/specialists/:id/edit',
        builder: (_, state) => const SpecialistFormScreen(),
      ),
      // Booking detail: a full-page screen pushed onto the root navigator,
      // reached by tapping a row of the list or the calendar. Declared before
      // the shell so it is not swallowed by the branch's own routes.
      GoRoute(
        path: bookingDetailPath(':id'),
        builder: (_, state) => BookingDetailScreen(id: state.pathParameters['id']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, navigationShell) => SalonShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/dashboard', builder: (_, _) => const SalonDashboardScreen()),
            ],
          ),
          StatefulShellBranch(
            // The list is the tab's root; the calendar is a sibling view of
            // the same bookings, so both live in this one branch and share the
            // tab's navigation stack.
            routes: [
              GoRoute(path: '/bookings', builder: (_, _) => const BookingsListScreen()),
              GoRoute(path: bookingsCalendarPath, builder: (_, _) => const SalonCalendarView()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: specialistsPath, builder: (_, _) => const SpecialistListScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/finance', builder: (_, _) => const SalonFinancialScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
            ],
          ),
        ],
      ),
    ],
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      // While the cached session is being read we cannot know yet, so hold the
      // redirect rather than bouncing a signed-in user to the login screen.
      if (auth.isRestoring) return null;

      final onAuthPath = state.matchedLocation.startsWith('/auth');
      if (!auth.isAuthenticated) {
        return onAuthPath ? null : '/auth/login';
      }
      if (onAuthPath) return '/dashboard';
      return null;
    },
  );
});
