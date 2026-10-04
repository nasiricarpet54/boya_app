import 'package:customer_app/features/booking/presentation/screens/booking_success_screen.dart';
import 'package:customer_app/features/booking/presentation/widgets/booking_confirm_dialog.dart';
import 'package:customer_app/features/profile/domain/booking_record.dart';
import 'package:customer_app/features/profile/presentation/widgets/booking_history_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

BookingRecord _booking(String status) {
  return BookingRecord(
    id: 'b1',
    status: status,
    start: DateTime(2026, 1, 1, 10, 30),
    totalPrice: 250000,
    tenantId: 't1',
    serviceName: 'کوتاهی مو',
    salonName: 'سالن بویا',
  );
}

Future<void> _pumpCard(WidgetTester tester, String status) {
  return tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(home: Scaffold(body: BookingHistoryCard(booking: _booking(status)))),
    ),
  );
}

void main() {
  group('booking status badge', () {
    testWidgets('labels every lifecycle state', (tester) async {
      const expected = <String, String>{
        'pending': 'در انتظار تایید',
        'confirmed': 'تایید شده',
        'completed': 'انجام‌شده',
        'reviewed': 'بازخورد داده شده',
        'cancelled': 'لغو‌شده',
        'no_show': 'عدم مراجعه',
      };

      for (final entry in expected.entries) {
        await _pumpCard(tester, entry.key);
        expect(find.text(entry.value), findsOneWidget);
      }
    });

    testWidgets('offers feedback only while the review is still open', (tester) async {
      await _pumpCard(tester, 'completed');
      expect(find.text('ثبت بازخورد'), findsOneWidget);

      await _pumpCard(tester, 'reviewed');
      expect(find.text('ثبت بازخورد'), findsNothing);
    });
  });

  testWidgets('success screen ends the flow without a payment step', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: BookingSuccessScreen()));

    expect(find.text('درخواست ثبت شد، در انتظار تایید سالن'), findsOneWidget);
    expect(find.text('تسویه در محل، هنگام مراجعه'), findsOneWidget);
  });

  testWidgets('final confirmation states the bill is settled at the salon', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: BookingConfirmDialog(
          salonName: 'سالن بویا',
          specialistName: 'سارا',
          serviceName: 'کوتاهی مو',
          date: DateTime(2026, 1, 1),
          price: '۲۵۰٬۰۰۰ تومان',
        ),
      ),
    );

    expect(find.text('تایید نهایی رزرو'), findsOneWidget);
    expect(find.text('پرداخت آنلاین وجود ندارد؛ تسویه در محل، هنگام مراجعه انجام می‌شود.'), findsOneWidget);
  });
}
