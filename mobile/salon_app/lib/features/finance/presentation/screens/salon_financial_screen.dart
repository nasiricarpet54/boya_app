import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/salon_app_bar.dart';
import '../widgets/jalali_range_selector.dart';

class SalonFinancialScreen extends StatefulWidget {
  const SalonFinancialScreen({super.key});

  @override
  State<SalonFinancialScreen> createState() => _SalonFinancialScreenState();
}

class _SalonFinancialScreenState extends State<SalonFinancialScreen> {
  FinancePreset _preset = FinancePreset.thisMonth;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SalonAppBar(title: 'مدیریت مالی'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          JalaliRangeSelector(preset: _preset, onPreset: (value) => setState(() => _preset = value)),
          const SizedBox(height: 12),
          Text(jalaliRangeLabel(_preset, DateTime.now()), style: BoyaTypography.body, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          DecoratedBox(
            decoration: BoxDecoration(color: BoyaColors.primary, borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('درآمد کل دوره', style: BoyaTypography.caption.copyWith(color: BoyaColors.white)),
                  Text(formatPrice(0), style: BoyaTypography.display.copyWith(color: BoyaColors.white)),
                  const SizedBox(height: 12),
                  Text('تعداد رزرو: ${toPersianDigits('0')}', style: BoyaTypography.body.copyWith(color: BoyaColors.white)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'نمودار روزانه، تسهیم کمیسیون و فهرست تراکنش وقتی پرداخت از سرور برسد نمایش داده می‌شود.',
            style: BoyaTypography.body,
          ),
        ],
      ),
    );
  }
}
