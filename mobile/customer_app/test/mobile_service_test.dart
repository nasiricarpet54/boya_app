import 'dart:convert';
import 'dart:typed_data';

import 'package:customer_app/core/network/api_client.dart';
import 'package:customer_app/features/auth/data/session_store.dart';
import 'package:customer_app/features/booking/application/booking_controller.dart';
import 'package:customer_app/features/booking/domain/booking_draft.dart';
import 'package:customer_app/features/booking/presentation/screens/booking_success_screen.dart';
import 'package:customer_app/features/booking/presentation/widgets/booking_confirm_dialog.dart';
import 'package:customer_app/features/booking/presentation/widgets/booking_form.dart';
import 'package:customer_app/features/home/data/salon_api.dart';
import 'package:customer_app/features/home/domain/salon_summary.dart';
import 'package:customer_app/features/profile/domain/booking_record.dart';
import 'package:customer_app/features/salon/data/salon_api.dart' as salon_api;
import 'package:customer_app/features/salon/domain/available_slot.dart';
import 'package:customer_app/features/salon/domain/salon_detail.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// ADR-011: the «خدمات سیار» (mobile service) feature, end to end.
///
/// The backend omits a flag rather than sending `false`, every model defaults
/// to false, and both the service *and* the specialist must travel for an
/// on-site booking to be valid. Those invariants are the parts worth pinning.

/// A scripted transport so the query string and the POST body are both
/// observable. Modeled on the stub in `auth_refresh_test.dart`.
class _Script {
  _Script(this.client, this.requests);

  final Dio client;
  final List<RequestOptions> requests;
}

typedef _Responder = ResponseBody Function(RequestOptions options);

_Script _scripted(Map<String, _Responder> routes) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
  final script = _Script(dio, []);
  dio.httpClientAdapter = _StubAdapter(routes, script);
  return script;
}

ResponseBody _json(Object body, [int status = 200]) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this._routes, this._script);

  final Map<String, _Responder> _routes;
  final _Script _script;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    _script.requests.add(options);
    final responder = _routes[options.path];
    if (responder == null) {
      return _json({'message': 'no route'}, 404);
    }
    return responder(options);
  }
}

/// A salon row with both the summary-level flag and the detail-level flags set.
Map<String, dynamic> _mobileSalonJson() => {
      'id': 's1',
      'name': 'سالن سیار',
      'rating': 4.8,
      'reviewCount': 10,
      'minPrice': 200000,
      'offersMobileService': true,
    };

void main() {
  group('defaults are false until the backend says otherwise', () {
    test('SalonSummary reads offersMobileService', () {
      final withFlag = SalonSummary.fromJson(_mobileSalonJson());
      expect(withFlag.offersMobileService, isTrue,
          reason: 'the home feed badge is driven by this flag');

      final withoutFlag = SalonSummary.fromJson({'id': 's2', 'name': 'سالن معمولی'});
      expect(withoutFlag.offersMobileService, isFalse,
          reason: 'an omitted flag must never read as true');
    });

    test('SalonDetail reads both flags independently', () {
      final detail = SalonDetail.fromJson({
        'id': 's1',
        'name': 'سالن',
        'services': [
          {'id': 'sv1', 'name': 'کوتاهی در منزل', 'price': 300000, 'isMobileAvailable': true},
          {'id': 'sv2', 'name': 'کراتینه', 'price': 900000},
        ],
        'specialists': [
          {'id': 'sp1', 'fullName': 'سارا', 'offersMobileService': true},
          {'id': 'sp2', 'fullName': 'مریم'},
        ],
      });

      expect(detail.services.firstWhere((it) => it.id == 'sv1').isMobileAvailable, isTrue);
      expect(detail.services.firstWhere((it) => it.id == 'sv2').isMobileAvailable, isFalse);
      expect(detail.specialists.firstWhere((it) => it.id == 'sp1').offersMobileService, isTrue);
      expect(detail.specialists.firstWhere((it) => it.id == 'sp2').offersMobileService, isFalse);
    });

    test('BookingRecord reads isMobile and customerAddress', () {
      final record = BookingRecord.fromJson({
        'id': 'b1',
        'status': 'pending',
        'startsAt': '2026-01-01T10:30:00.000Z',
        'totalPrice': 300000,
        'isMobile': true,
        'customerAddress': 'تهران، خیابان ولیعصر',
      });
      expect(record.isMobile, isTrue);
      expect(record.customerAddress, 'تهران، خیابان ولیعصر');
    });

    test('BookingRecord keeps both fields off when they are absent', () {
      final record = BookingRecord.fromJson({
        'id': 'b2',
        'status': 'confirmed',
        'startsAt': '2026-01-01T11:00:00.000Z',
        'totalPrice': 150000,
      });
      expect(record.isMobile, isFalse);
      expect(record.customerAddress, isNull);
    });
  });

  group('the mobile filter travels as ?mobile=true', () {
    test('sends the parameter only when it is explicitly true', () async {
      final script = _scripted({
        '/salons': (_) => _json({'data': [_mobileSalonJson()]}),
      });

      await SalonsApi(script.client).getSalons(mobile: true);

      expect(script.requests.single.queryParameters, containsPair('mobile', true),
          reason: 'the chip is on, so the backend has to receive ?mobile=true');
    });

    test('omits the parameter entirely when the chip is off', () async {
      final script = _scripted({
        '/salons': (_) => _json({'data': <Map<String, dynamic>>[]}),
      });

      // `null`, not `false`: the backend keys the filter off ?mobile=true and a
      // ?mobile=false would be read as set, narrowing the unfiltered feed.
      await SalonsApi(script.client).getSalons(mobile: null);

      expect(script.requests.single.queryParameters, isNot(contains('mobile')));
    });

    test('parses offersMobileService off the rows it gets back', () async {
      final script = _scripted({
        '/salons': (_) => _json({'data': [_mobileSalonJson()]}),
      });

      final salons = await SalonsApi(script.client).getSalons(mobile: true);

      expect(salons.single.offersMobileService, isTrue);
    });
  });

  group('POST /bookings carries the on-site fields', () {
    /// Boots the real controller against a stubbed transport, so the payload
    /// the backend receives is exactly what the draft held.
    Future<ProviderContainer> boot(_Script script) async {
      final container = ProviderContainer(overrides: [
        dioProvider.overrideWithValue(script.client),
        sessionStoreProvider.overrideWithValue(InMemorySessionStore()),
      ]);
      await container.pump();
      return container;
    }

    test('includes isMobile, the address and the coordinates', () async {
      final script = _scripted({
        '/bookings': (_) => _json({
              'id': 'b1',
              'status': 'pending',
              'startsAt': '2026-01-01T10:30:00.000Z',
              'totalPrice': 300000,
            }),
      });
      final container = await boot(script);

      final controller = container.read(bookingProvider.notifier);
      controller.save(
        BookingDraft(
          salonId: 's1',
          specialistId: 'sp1',
          serviceId: 'sv1',
          date: DateTime(2026, 1, 1, 10, 30),
          slotStart: DateTime(2026, 1, 1, 10, 30),
          isMobile: true,
          customerAddress: 'تهران، خیابان ولیعصر',
          customerLatitude: 35.7,
          customerLongitude: 51.4,
        ),
      );
      await controller.submit();

      final body = jsonDecode(jsonEncode(script.requests.single.data)) as Map<String, dynamic>;
      expect(body, containsPair('isMobile', true));
      expect(body, containsPair('customerAddress', 'تهران، خیابان ولیعصر'));
      expect(body, containsPair('customerLatitude', 35.7));
      expect(body, containsPair('customerLongitude', 51.4));

      container.dispose();
    });

    test('sends nothing on-site when the booking is at the salon', () async {
      final script = _scripted({
        '/bookings': (_) => _json({
              'id': 'b2',
              'status': 'pending',
              'startsAt': '2026-01-01T11:00:00.000Z',
              'totalPrice': 150000,
            }),
      });
      final container = await boot(script);

      final controller = container.read(bookingProvider.notifier);
      controller.save(
        BookingDraft(
          salonId: 's1',
          specialistId: 'sp1',
          serviceId: 'sv1',
          date: DateTime(2026, 1, 1, 11, 0),
          slotStart: DateTime(2026, 1, 1, 11, 0),
        ),
      );
      await controller.submit();

      final body = jsonDecode(jsonEncode(script.requests.single.data)) as Map<String, dynamic>;
      expect(body, isNot(contains('isMobile')),
          reason: 'a false flag would be read as set by some validators');
      expect(body, isNot(contains('customerAddress')));

      container.dispose();
    });

    test('keeps the created row for the success screen to read', () async {
      final script = _scripted({
        '/bookings': (_) => _json({
              'id': 'b3',
              'status': 'pending',
              'startsAt': '2026-01-01T10:30:00.000Z',
              'totalPrice': 300000,
              'isMobile': true,
              'customerAddress': 'تهران، خیابان ولیعصر',
            }),
      });
      final container = await boot(script);

      final controller = container.read(bookingProvider.notifier);
      controller.save(
        BookingDraft(
          salonId: 's1',
          specialistId: 'sp1',
          serviceId: 'sv1',
          date: DateTime(2026, 1, 1, 10, 30),
          isMobile: true,
          customerAddress: 'تهران، خیابان ولیعصر',
        ),
      );
      final record = await controller.submit();

      expect(record.isMobile, isTrue);
      expect(record.customerAddress, 'تهران، خیابان ولیعصر');
      expect(container.read(bookingProvider).record, same(record));

      container.dispose();
    });
  });

  group('the screens the customer sees afterwards', () {
    testWidgets('the success screen shows the address and the on-site payment note', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            bookingProvider.overrideWith(() => _FakeBookingState(BookingRecord(
                  id: 'b1',
                  status: 'pending',
                  start: DateTime(2026, 1, 1, 10, 30),
                  totalPrice: 300000,
                  serviceName: 'کوتاهی در منزل',
                  salonName: 'سالن سیار',
                  isMobile: true,
                  customerAddress: 'تهران، خیابان ولیعصر',
                ))),
          ],
          child: const MaterialApp(home: BookingSuccessScreen()),
        ),
      );

      expect(find.text('درخواست ثبت شد، در انتظار تایید سالن'), findsOneWidget);
      expect(find.text('خدمت در محل شما'), findsOneWidget);
      expect(find.text('تهران، خیابان ولیعصر'), findsOneWidget);
      expect(find.text('پرداخت در محل'), findsOneWidget);
      // The salon-visit card must not be shown alongside the on-site one.
      expect(find.text('تسویه در محل، هنگام مراجعه'), findsNothing);
    });

    testWidgets('the success screen falls back to the salon card without a mobile booking',
        (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            bookingProvider.overrideWith(() => _FakeBookingState(BookingRecord(
                  id: 'b2',
                  status: 'pending',
                  start: DateTime(2026, 1, 1, 11, 0),
                  totalPrice: 150000,
                ))),
          ],
          child: const MaterialApp(home: BookingSuccessScreen()),
        ),
      );

      expect(find.text('تسویه در محل، هنگام مراجعه'), findsOneWidget);
      expect(find.text('خدمت در محل شما'), findsNothing);
    });

    testWidgets('the confirmation lists the on-site venue', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BookingConfirmDialog(
            salonName: 'سالن سیار',
            specialistName: 'سارا',
            serviceName: 'کوتاهی در منزل',
            date: DateTime(2026, 1, 1),
            isMobile: true,
            address: 'تهران، خیابان ولیعصر',
          ),
        ),
      );

      // The row renders the label with a trailing colon, so the substring is
      // what actually distinguishes an on-site confirmation.
      expect(find.textContaining('محل اجرا'), findsOneWidget);
      expect(find.text('تهران، خیابان ولیعصر'), findsOneWidget);
    });

    testWidgets('the confirmation stays quiet about a venue when the visit is at the salon',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BookingConfirmDialog(
            salonName: 'سالن بویا',
            specialistName: 'سارا',
            serviceName: 'کوتاهی مو',
            date: DateTime(2026, 1, 1),
          ),
        ),
      );

      expect(find.textContaining('محل اجرا'), findsNothing);
    });
  });


  group('the booking form toggle', () {
    /// A salon whose one service and one specialist both travel, so the toggle
    /// can be enabled. Variants below flip one flag at a time.
    SalonDetail makeSalon({bool serviceMobile = true, bool specialistMobile = true}) {
      return SalonDetail(
        id: 's1',
        name: 'سالن',
        services: [
          SalonService(id: 'sv1', name: 'کوتاهی در منزل', price: 300000, isMobileAvailable: serviceMobile),
        ],
        specialists: [
          SalonSpecialist(id: 'sp1', fullName: 'سارا', offersMobileService: specialistMobile),
        ],
      );
    }

    /// Slots are stubbed rather than fetched: the form only needs the grid to
    /// build, not real availability. The mobile section is the last item of the
    /// form's list, so it is scrolled into view before the caller asserts —
    /// a `ListView` only builds the rows the viewport can see.
    Future<void> pumpForm(
      WidgetTester tester, {
      required SalonDetail salon,
      required String? specialistId,
      required String? serviceId,
      required bool isMobile,
      String address = '',
      ValueChanged<bool>? onMobile,
      ValueChanged<String>? onAddress,
    }) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            salon_api.salonApiProvider.overrideWith((ref) => _SlotlessSalonApi()),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: BookingForm(
                salon: salon,
                // The form's service list is owned by the screen now; these
                // tests model the "no specialist chosen yet" state, so the
                // full catalogue is what the picker shows.
                services: salon.services,
                servicesLoading: false,
                specialistId: specialistId,
                serviceId: serviceId,
                date: DateTime(2026, 1, 1),
                selectedSlot: null,
                onSpecialist: (_) {},
                onService: (_) {},
                onDate: (_) {},
                onSlot: (_) {},
                isMobile: isMobile,
                address: address,
                onMobile: onMobile ?? (_) {},
                onAddress: onAddress ?? (_) {},
              ),
            ),
          ),
        ),
      );
      // Let the stubbed slot future settle, then bring step 5 on screen.
      await tester.pumpAndSettle();
      if (specialistId != null && serviceId != null) {
        await tester.scrollUntilVisible(find.text('۵. محل اجرا'), 400);
        await tester.pumpAndSettle();
      }
    }

    testWidgets('waits for both picks before showing a reason', (tester) async {
      await pumpForm(
        tester,
        salon: makeSalon(),
        specialistId: 'sp1',
        serviceId: null,
        isMobile: false,
      );

      // Step 5 renders only once the calendar does, so the placeholder is not
      // even on the tree yet.
      expect(find.text('۵. محل اجرا'), findsNothing);
    });

    testWidgets('says the specialist does not travel', (tester) async {
      await pumpForm(
        tester,
        salon: makeSalon(specialistMobile: false),
        specialistId: 'sp1',
        serviceId: 'sv1',
        isMobile: false,
      );

      expect(find.text('۵. محل اجرا'), findsOneWidget);
      expect(find.text('این متخصص خدمات سیار ارائه نمی‌دهد'), findsOneWidget);
      // Disabled, so tapping it must not flip the switch.
      expect(tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged, isNull);
    });

    testWidgets('says the service does not travel', (tester) async {
      await pumpForm(
        tester,
        salon: makeSalon(serviceMobile: false),
        specialistId: 'sp1',
        serviceId: 'sv1',
        isMobile: false,
      );

      expect(find.text('این خدمت به‌صورت سیار ارائه نمی‌شود'), findsOneWidget);
      expect(tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged, isNull);
    });

    testWidgets('enables the toggle and unlocks the address field', (tester) async {
      await pumpForm(
        tester,
        salon: makeSalon(),
        specialistId: 'sp1',
        serviceId: 'sv1',
        isMobile: true,
        address: 'تهران، خیابان ولیعصر',
      );

      expect(tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged, isNotNull);
      expect(tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value, isTrue);
      expect(find.text('تهران، خیابان ولیعصر'), findsOneWidget);
      expect(find.text('پرداخت در محل'), findsOneWidget);
    });

    testWidgets('flags a missing address on the spot', (tester) async {
      await pumpForm(
        tester,
        salon: makeSalon(),
        specialistId: 'sp1',
        serviceId: 'sv1',
        isMobile: true,
      );

      expect(find.text('آدرس مشتری الزامی است'), findsOneWidget);
    });

    testWidgets('forwards the toggle to the screen', (tester) async {
      var toggled = false;
      await pumpForm(
        tester,
        salon: makeSalon(),
        specialistId: 'sp1',
        serviceId: 'sv1',
        isMobile: false,
        onMobile: (value) => toggled = value,
      );

      await tester.tap(find.byType(SwitchListTile));
      await tester.pump();

      expect(toggled, isTrue);
    });
  });
}

/// A [SalonApi] whose slot endpoint always answers "nothing bookable", so the
/// booking form can build its calendar without a network or a stubbed route.
class _SlotlessSalonApi extends salon_api.SalonApi {
  _SlotlessSalonApi() : super(Dio());

  @override
  Future<List<AvailableSlot>> getAvailableSlots({
    required String salonId,
    required DateTime date,
    required String serviceId,
    String? specialistId,
  }) async {
    return const <AvailableSlot>[];
  }
}

/// A [BookingController] that only ever holds the record a test hands it, so
/// the success screen can be rendered without a POST round-trip.
class _FakeBookingState extends BookingController {
  _FakeBookingState(this.record);

  final BookingRecord record;

  @override
  BookingState build() => BookingState(record: record);
}