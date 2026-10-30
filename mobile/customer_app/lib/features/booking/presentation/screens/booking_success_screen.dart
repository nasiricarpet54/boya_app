import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/boya_app_bar.dart';
import '../../application/booking_controller.dart';

/// End of the Phase 1 booking flow.
///
/// There is no gateway and no payment step: the request waits for the salon's
/// approval and the bill is paid at the salon when the customer shows up.
class BookingSuccessScreen extends ConsumerWidget {
  const BookingSuccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The just-booked record, kept by BookingController so the screen can
    // echo back what the customer actually agreed to — including, for ADR-011,
    // that the specialist is coming to them.
    final record = ref.watch(bookingProvider).record;
    final isMobile = record?.isMobile ?? false;
    final address = record?.customerAddress;
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
            isMobile
                // ADR-011: the specialist travels to the customer, so the copy
                // promises a visit rather than a salon appointment.
                ? 'پس از تایید سالن، متخصص در محل شما حاضر می‌شود.'
                : 'پس از تایید سالن، نوبت شما قطعی می‌شود.',
            textAlign: TextAlign.center,
            style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
          ),
          const SizedBox(height: 24),
          // ADR-011: the on-site banner replaces the salon-visit card. Both
          // cards carry the same "no online payment" promise, only the venue
          // changes, so only one of the two is ever shown.
          if (isMobile)
            Card(
              color: BoyaColors.primarySubtle,
              elevation: 0,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    const Icon(Icons.directions_car, size: 40, color: BoyaColors.primary),
                    const SizedBox(height: 12),
                    Text('خدمت در محل شما', style: BoyaTypography.title),
                    const SizedBox(height: 8),
                    if (address != null && address.isNotEmpty) ...[
                      Text(
                        address,
                        textAlign: TextAlign.center,
                        style: BoyaTypography.body.copyWith(color: BoyaColors.ink),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      'متخصص در تاریخ و ساعت مقرر به این آدرس مراجعه می‌کند.',
                      textAlign: TextAlign.center,
                      style: BoyaTypography.caption,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.payments_outlined, size: 14, color: BoyaColors.primary),
                        const SizedBox(width: 6),
                        Text(
                          'پرداخت در محل',
                          style: BoyaTypography.overline.copyWith(
                            color: BoyaColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            )
          else
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
