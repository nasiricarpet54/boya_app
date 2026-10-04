import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

import 'features/bookings/presentation/screens/my_bookings_screen.dart';
import 'features/dashboard/presentation/screens/specialist_dashboard_screen.dart';
import 'features/profile/presentation/screens/specialist_profile_screen.dart';

class SpecialistShell extends StatefulWidget {
  const SpecialistShell({super.key});

  @override
  State<SpecialistShell> createState() => _SpecialistShellState();
}

class _SpecialistShellState extends State<SpecialistShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: const [
        SpecialistDashboardScreen(),
        MyBookingsScreen(),
        SpecialistProfileScreen(),
      ][_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'خانه'),
          NavigationDestination(icon: Icon(Icons.calendar_month), label: 'نوبت‌ها'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'پروفایل'),
        ],
      ),
    );
  }
}
