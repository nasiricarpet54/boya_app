import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/salon_app_bar.dart';
import '../../application/salon_dashboard_controller.dart';
import '../widgets/weekly_revenue_chart.dart';

class SalonDashboardScreen extends ConsumerWidget {
  const SalonDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(salonDashboardStatsProvider);
    final now = DateTime.now();
    final weekStart = jalaliWeekStart(now);
    return Scaffold(
      appBar: const SalonAppBar(title: 'داشبورد بویا'),
      body: statsAsync.when(
        data: (stats) => RefreshIndicator(
          color: BoyaColors.primary,
          onRefresh: () => ref.refresh(salonDashboardStatsProvider.future),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              DecoratedBox(
                decoration: BoxDecoration(color: BoyaColors.primary, borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(formatJalaliFull(now), style: BoyaTypography.caption.copyWith(color: BoyaColors.white)),
                      const SizedBox(height: 4),
                      Text(
                        'بازه هفته: ${formatJalaliFull(weekStart)} تا ${formatJalaliFull(weekStart.add(const Duration(days: 6)))}',
                        style: BoyaTypography.overline.copyWith(color: BoyaColors.white),
                      ),
                      const SizedBox(height: 8),
                      Text('خلاصه امروز', style: BoyaTypography.headline.copyWith(color: BoyaColors.white)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(child: _Stat(label: 'رزروها', value: toPersianDigits('${stats.todayBookings}'))),
                          const SizedBox(width: 12),
                          Expanded(child: _Stat(label: 'درآمد', value: formatPrice(stats.todayRevenue))),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: _SummaryCard(
                      label: 'رزروهای هفته',
                      value: toPersianDigits('${stats.weekBookings}'),
                      icon: Icons.event_available_outlined,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _SummaryCard(
                      label: 'در انتظار تأیید',
                      value: toPersianDigits('${stats.pendingBookings}'),
                      icon: Icons.hourglass_empty,
                      tone: BoyaColors.warning,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text('درآمد هفته', style: BoyaTypography.title),
              const SizedBox(height: 12),
              WeeklyRevenueChart(days: stats.weeklyRevenue),
              const SizedBox(height: 24),
              Text('متخصصان برتر هفته', style: BoyaTypography.title),
              const SizedBox(height: 12),
              if (stats.topSpecialists.isEmpty)
                const Text('رزرو تأییدشده‌ای در این هفته ثبت نشده', style: BoyaTypography.body)
              else
                for (final specialist in stats.topSpecialists)
                  Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: const Icon(Icons.person_outline, color: BoyaColors.primary),
                      title: Text(
                        specialist.fullName?.isNotEmpty == true ? specialist.fullName! : 'متخصص',
                        style: BoyaTypography.body,
                      ),
                      subtitle: Text(
                        '${toPersianDigits('${specialist.bookings}')} رزرو',
                        style: BoyaTypography.caption,
                      ),
                      trailing: Text(formatPrice(specialist.revenue), style: BoyaTypography.caption),
                    ),
                  ),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (_, errorInfo) => _DashboardError(onRetry: () => ref.invalidate(salonDashboardStatsProvider)),
      ),
    );
  }
}
/// Error state with a retry button. Without one the tab would be stuck on the
/// failed request until the whole app restarts.
class _DashboardError extends StatelessWidget {
  const _DashboardError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('خطا در دریافت اطلاعات', style: BoyaTypography.body),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('تلاش مجدد')),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.icon,
    this.tone = BoyaColors.primary,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: BoyaColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BoyaColors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: tone),
            const SizedBox(height: 8),
            Text(value, style: BoyaTypography.title),
            const SizedBox(height: 2),
            Text(label, style: BoyaTypography.caption),
          ],
        ),
      ),
    );
  }
}


class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: BoyaTypography.caption.copyWith(color: BoyaColors.white)),
        Text(value, style: BoyaTypography.title.copyWith(color: BoyaColors.white)),
      ],
    );
  }
}
