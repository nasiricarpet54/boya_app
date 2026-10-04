import 'package:boya_shared/boya_shared.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../domain/salon_dashboard_stats.dart';

class WeeklyRevenueChart extends StatelessWidget {
  const WeeklyRevenueChart({required this.days, super.key});

  final List<SalonDayRevenue> days;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) {
      return const SizedBox(
        height: 120,
        child: Center(child: Text('درآمد این هفته هنوز ثبت نشده', style: BoyaTypography.body)),
      );
    }
    return SizedBox(
      height: 200,
      child: BarChart(
        BarChartData(
          alignment: BarChartAlignment.spaceAround,
          barGroups: [
            for (final day in days)
              BarChartGroupData(
                x: day.dayIndex,
                barRods: [
                  BarChartRodData(toY: day.amount, color: BoyaColors.primary, width: 16, borderRadius: BorderRadius.circular(4)),
                ],
              ),
          ],
          titlesData: FlTitlesData(
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index < 0 || index >= persianDayNames.length) return const SizedBox.shrink();
                  return Text(persianDayNames[index], style: BoyaTypography.overline);
                },
              ),
            ),
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
        ),
      ),
    );
  }
}
