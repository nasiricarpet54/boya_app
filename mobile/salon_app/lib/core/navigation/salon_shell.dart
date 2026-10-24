import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';

class SalonTab {
  const SalonTab(this.title, this.icon, this.selectedIcon, this.branch);
  final String title;
  final IconData icon;
  final IconData selectedIcon;
  final int branch;
}

const _ownerBranches = [0,1,2,3,4];
const _specialistBranches = [1,3,4];

List<int> branchesForRole(String? role) {
  switch (role) {
    case 'salon_owner':
    case 'admin':
      return _ownerBranches;
    default:
      return _specialistBranches;
  }
}

final Map<String, List<SalonTab>> roleTabs = {
  'salon_owner': [
    const SalonTab('خانه', Icons.home_outlined, Icons.home, 0),
    const SalonTab('رزروها', Icons.calendar_today_outlined, Icons.calendar_today, 1),
    const SalonTab('متخصصان', Icons.people_outlined, Icons.people, 2),
    const SalonTab('مالی', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet, 3),
    const SalonTab('پروفایل', Icons.person_outlined, Icons.person, 4),
  ],
  'admin': [
    const SalonTab('خانه', Icons.home_outlined, Icons.home, 0),
    const SalonTab('رزروها', Icons.calendar_today_outlined, Icons.calendar_today, 1),
    const SalonTab('متخصصان', Icons.people_outlined, Icons.people, 2),
    const SalonTab('مالی', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet, 3),
    const SalonTab('پروفایل', Icons.person_outlined, Icons.person, 4),
  ],
  'specialist': [
    const SalonTab('رزروها', Icons.calendar_today_outlined, Icons.calendar_today, 1),
    const SalonTab('کیف پول', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet, 3),
    const SalonTab('پروفایل', Icons.person_outlined, Icons.person, 4),
  ],
  'default': [
    const SalonTab('رزروها', Icons.calendar_today_outlined, Icons.calendar_today, 1),
    const SalonTab('کیف پول', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet, 3),
    const SalonTab('پروفایل', Icons.person_outlined, Icons.person, 4),
  ],
};

class SalonShellScreen extends ConsumerStatefulWidget {
  const SalonShellScreen({required this.navigationShell, super.key});
  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<SalonShellScreen> createState() => _SalonShellScreenState();
}

class _SalonShellScreenState extends ConsumerState<SalonShellScreen> {
  int get _currentIndex => widget.navigationShell.currentIndex;

  void _selectBranch(int index) {
    widget.navigationShell.goBranch(index, initialLocation: index == _currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.read(authControllerProvider).user?.role ?? 'default';
    final tabs = roleTabs[role] ?? roleTabs['default']!;
    final allowed = branchesForRole(role);
    final visibleTabs = tabs.where((tab) => allowed.contains(tab.branch)).toList();
    final branchFor = visibleTabs.map((tab) => tab.branch).toList();

    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: branchFor.indexOf(_currentIndex).clamp(0, visibleTabs.length - 1),
        onDestinationSelected: (index) => _selectBranch(branchFor[index]),
        indicatorColor: BoyaColors.primarySubtle,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: visibleTabs.map((tab) => NavigationDestination(
          icon: Icon(tab.icon, color: BoyaColors.inkMuted),
          selectedIcon: Icon(tab.selectedIcon, color: BoyaColors.primary),
          label: tab.title,
        )).toList(),
      ),
    );
  }
}

Future<void> logoutAndGo(BuildContext context, WidgetRef ref) async {
  await ref.read(authControllerProvider.notifier).logout();
  if (context.mounted) context.go('/auth/login');
}
