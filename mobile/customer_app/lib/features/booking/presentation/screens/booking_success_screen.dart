import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/boya_app_bar.dart';

/// End of the Phase 1 booking flow.
///
/// There is no gateway and no payment step: the request waits for the salon's
/// approval and the bill is paid at the salon when the customer shows up.
class BookingSuccessScreen extends StatelessWidget {
  const BookingSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BoyaAppBar(title: 'ثبت درخواست'),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 24),
          const Icon(Icons.check_circle, size: 96, color: BoyaColors.success),
          const SizedBox(height: 16),
          Text(
            'درخواست ثبت شد، در انتظار تایید سالن',
            textAlign: TextAlign.center,
            style: BoyaTypography.headline,
          ),
          const SizedBox(height: 8),
          Text(
            'پس از تایید سالن، نوبت شما قطعی می‌شود.',
            textAlign: TextAlign.center,
            style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Icon(Icons.storefront_outlined, size: 40, color: BoyaColors.primary),
                  const SizedBox(height: 12),
                  Text('تسویه در محل، هنگام مراجعه', style: BoyaTypography.title),
                  const SizedBox(height: 8),
                  Text(
                    'پرداخت آنلاین در بویا وجود ندارد؛ مبلغ خدمت را هنگام مراجعه به سالن پرداخت می‌کنید.',
                    textAlign: TextAlign.center,
                    style: BoyaTypography.caption,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: () => context.go('/profile/bookings'),
            child: const Text('مشاهده رزروهای من'),
          ),
          const SizedBox(height: 8),
          TextButton(onPressed: () => context.go('/home'), child: const Text('بازگشت به خانه')),
        ],
      ),
    );
  }
}
