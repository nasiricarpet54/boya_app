import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// Final step of the booking flow.
///
/// Phase 1 has no online payment (see PROJECT_CHARTER.md), so the step that
/// used to hand the customer over to a gateway is now a plain confirmation:
/// the request goes to the salon for approval and the bill is settled on site.
class BookingConfirmDialog extends StatelessWidget {
  const BookingConfirmDialog({
    required this.salonName,
    required this.specialistName,
    required this.serviceName,
    required this.date,
    super.key,
    this.price,
    this.time,
  });

  final String salonName;
  final String specialistName;
  final String serviceName;
  final DateTime date;
  final String? price;

  /// `HH:MM` label of the picked slot, when one was chosen.
  final String? time;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('تایید نهایی رزرو'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SummaryRow(label: 'سالن', value: salonName),
          _SummaryRow(label: 'متخصص', value: specialistName),
          _SummaryRow(label: 'خدمت', value: serviceName),
          _SummaryRow(label: 'تاریخ', value: formatJalaliFull(date)),
          if (time != null) _SummaryRow(label: 'ساعت', value: time!),
          if (price != null) _SummaryRow(label: 'مبلغ خدمت', value: price!),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: BoyaColors.primarySubtle,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'پرداخت آنلاین وجود ندارد؛ تسویه در محل، هنگام مراجعه انجام می‌شود.',
              style: BoyaTypography.caption.copyWith(color: BoyaColors.ink),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('انصراف')),
        FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('تایید و ثبت درخواست')),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$label: ', style: BoyaTypography.caption),
          Expanded(child: Text(value, style: BoyaTypography.body)),
        ],
      ),
    );
  }
}
