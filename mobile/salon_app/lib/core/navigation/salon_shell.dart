import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';

/// One destination of the bottom navigation bar.
class _SalonTab {
  const _SalonTab(this.title, this.icon, this.selectedIcon);

  final String title;
  final IconData icon;
  final IconData selectedIcon;
}

const _tabs = [
  _SalonTab('خانه', Icons.home_outlined, Icons.home),
  _SalonTab('رزروها', Icons.calendar_today_outlined, Icons.calendar_today),
  _SalonTab('متخصصان', Icons.people_outline, Icons.people),
  _SalonTab('مالی', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet),
  _SalonTab('پروفایل', Icons.person_outline, Icons.person),
];

/// The tabbed shell every authenticated screen renders inside. Each tab keeps
/// its own state in the indexed stack; switching tabs never resets the others.
class SalonShellScreen extends ConsumerStatefulWidget {
  const SalonShellScreen({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<SalonShellScreen> createState() => _SalonShellScreenState();
}

class _SalonShellScreenState extends ConsumerState<SalonShellScreen> {
  int get _currentIndex => widget.navigationShell.currentIndex;

  void _selectBranch(int index) {
    // Re-picking the tab already on screen restarts that route; that is what
    // the dashboard's pull-to-refresh shortcut relies on.
    widget.navigationShell.goBranch(index, initialLocation: index == _currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _selectBranch,
        indicatorColor: BoyaColors.primarySubtle,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          for (final tab in _tabs)
            NavigationDestination(
              icon: Icon(tab.icon, color: BoyaColors.inkMuted),
              selectedIcon: Icon(tab.selectedIcon, color: BoyaColors.primary),
              label: tab.title,
            ),
        ],
      ),
    );
  }
}

/// Logs the user out and lands on the login screen. Shared by the profile
/// menu and anywhere a "خروج" action lives.
Future<void> logoutAndGo(BuildContext context, WidgetRef ref) async {
  await ref.read(authControllerProvider.notifier).logout();
  if (context.mounted) context.go('/auth/login');
}
