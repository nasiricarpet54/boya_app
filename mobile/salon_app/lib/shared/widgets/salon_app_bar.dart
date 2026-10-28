import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/navigation/salon_shell.dart';
import '../../features/auth/application/auth_controller.dart';

/// Landing tab of the salon panel. The home shortcut jumps here.
const String salonHomePath = '/dashboard';

/// The landing tab for a given role: the owner dashboard answers `403` for
/// the provider roles, so their home is their own bookings instead.
String salonHomePathFor(String? role) =>
    providerRoles.contains(role) ? '/bookings' : salonHomePath;

/// The app bar shared by every salon screen.
///
/// The leading slot is derived from the navigation stack: a route that can be
/// popped gets the RTL back arrow, a shell root route gets the home icon. In RTL
/// the actions render on the left edge of the bar, which is where the always-on
/// home shortcut lives.
///
/// Always a plain [AppBar] so it can live in `Scaffold.appBar`. A screen that
/// needs a tab strip under the title passes it as [bottom] (a [TabBar]).
class SalonAppBar extends StatelessWidget implements PreferredSizeWidget {
  const SalonAppBar({required this.title, this.bottom, super.key});

  /// Centered screen title.
  final String title;

  /// Widget under the title, typically a [TabBar]. The shared bar measures the
  /// combined height so `Scaffold.appBar` lays the body out below it.
  final PreferredSizeWidget? bottom;

  @override
  Size get preferredSize => Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  /// The leading slot, derived from the navigation stack instead of being
  /// passed by each screen.
  Widget _leading(BuildContext context) {
    final navigator = Navigator.of(context);
    final foreground = Theme.of(context).colorScheme.onSurface;
    return navigator.canPop()
        ? IconButton(
            icon: const Icon(Icons.arrow_forward),
            onPressed: navigator.pop,
            tooltip: 'بازگشت',
          )
        : _SalonHomeButton(color: foreground);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final foreground = theme.colorScheme.onSurface;
    return AppBar(
      elevation: 0,
      centerTitle: true,
      title: Text(title, style: BoyaTypography.title.copyWith(color: foreground)),
      leading: _leading(context),
      actions: [_SalonHomeButton(color: foreground)],
      bottom: bottom,
    );
  }
}

/// Home shortcut used by both slots of [SalonAppBar].
///
/// Reads the signed-in role so the landing tab follows it: the owner jumps to
/// the dashboard, a provider role — whose dashboard answers `403` — to their
/// own bookings.
class _SalonHomeButton extends ConsumerWidget {
  const _SalonHomeButton({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(authControllerProvider).user?.role;
    return IconButton(
      icon: Icon(Icons.home_outlined, color: color),
      onPressed: () => context.go(salonHomePathFor(role)),
      tooltip: 'خانه',
    );
  }
}
