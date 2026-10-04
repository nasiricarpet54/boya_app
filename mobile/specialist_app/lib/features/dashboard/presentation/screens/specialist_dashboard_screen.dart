import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

import '../../../schedule/presentation/screens/my_schedule_screen.dart';

class SpecialistDashboardScreen extends StatelessWidget {
  const SpecialistDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('داشبورد متخصص')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(formatJalaliFull(DateTime.now()), style: BoyaTypography.title),
          const SizedBox(height: 16),
          Text('درآمد امروز: ${formatPrice(0)}', style: BoyaTypography.body),
          const SizedBox(height: 8),
          const Text('نوبت امروز و نوبت بعدی از سرور نرسیده است.', style: BoyaTypography.body),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const MyScheduleScreen()));
            },
            child: const Text('برنامه هفتگی'),
          ),
        ],
      ),
    );
  }
}
