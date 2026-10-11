import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_app/features/bookings/data/bookings_api.dart';
import 'package:salon_app/features/bookings/domain/booking_summary.dart';
import 'package:salon_app/features/services/data/services_api.dart';
import 'package:salon_app/features/services/domain/service_line.dart';
import 'package:salon_app/features/specialists/data/specialist_api.dart';
import 'package:salon_app/features/specialists/domain/salon_specialist.dart';

/// A [Dio] adapter that answers every request with [body], recording what was
/// sent so the ADR-011 writes can be asserted without a server.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this._body, this.sent);

  final Map<String, dynamic> _body;
  final List<RequestOptions> sent;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    sent.add(options);
    return ResponseBody.fromString(
      jsonEncode(_body),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

/// The minimal shape both panel write endpoints answer with.
const _writeOk = {'status': 'approved', 'message': 'ذخیره شد'};

/// Every booking field the panel reads, so a [BookingSummary] round-trip does
/// not trip on a missing optional.
const _baseBooking = {
  'id': 'b1',
  'status': 'confirmed',
  'startsAt': '2026-10-15T10:00:00.000Z',
  'endsAt': '2026-10-15T11:00:00.000Z',
  'totalPrice': 250000,
  'depositPaid': 50000,
  'createdAt': '2026-10-01T09:00:00.000Z',
  'customerId': 'c1',
  'customerName': 'نگار',
  'customerPhone': '09120001122',
  'specialistName': 'سارا',
  'serviceName': 'کوتاهی مو',
};

void main() {
  group('coordinateFromJson', () {
    test('accepts both a JSON number and the decimal text pg sends', () {
      expect(coordinateFromJson(35.6892), 35.6892);
      // `numeric(10,7)` arrives as decimal text (ADR-011), padded to scale.
      expect(coordinateFromJson('35.6892000'), 35.6892);
      // The UI builds `Number(...)` off this; extra whitespace must not break it.
      expect(coordinateFromJson(' 51.389 '), 51.389);
    });

    test('yields null for anything unparseable rather than throwing', () {
      expect(coordinateFromJson(null), isNull);
      expect(coordinateFromJson(''), isNull);
      expect(coordinateFromJson('تهران'), isNull);
    });
  });

  group('BookingSummary.fromJson', () {
    test('reads an on-site booking with its address and coordinates', () {
      final booking = BookingSummary.fromJson({
        ..._baseBooking,
        'isMobile': true,
        'customerAddress': 'تهران، خیابان ولیعصر',
        'customerLatitude': '35.6892000',
        'customerLongitude': '51.3890000',
      });

      expect(booking.isMobile, isTrue);
      expect(booking.customerAddress, 'تهران، خیابان ولیعصر');
      expect(booking.customerLatitude, 35.6892);
      expect(booking.customerLongitude, 51.389);
      // Both halves are needed before the navigation button is offered.
      expect(booking.hasCoordinates, isTrue);
    });

    test('also accepts real JSON numbers for the coordinates', () {
      final booking = BookingSummary.fromJson({
        ..._baseBooking,
        'isMobile': true,
        'customerLatitude': 35.6892,
        'customerLongitude': 51.389,
      });

      expect(booking.customerLatitude, 35.6892);
      expect(booking.customerLongitude, 51.389);
      expect(booking.hasCoordinates, isTrue);
    });

    test('defaults an in-salon booking to not mobile and no address', () {
      final booking = BookingSummary.fromJson(_baseBooking);

      expect(booking.isMobile, isFalse);
      expect(booking.customerAddress, isNull);
      expect(booking.customerLatitude, isNull);
      expect(booking.customerLongitude, isNull);
      expect(booking.hasCoordinates, isFalse);
    });

    test('with only one coordinate still has no navigation target', () {
      final booking = BookingSummary.fromJson({
        ..._baseBooking,
        'isMobile': true,
        'customerAddress': 'تهران',
        'customerLatitude': '35.6892',
      });

      expect(booking.hasCoordinates, isFalse);
    });
  });

  group('BookingPage.fromJson', () {
    test('carries the on-site fields onto each list row', () {
      final page = BookingPage.fromJson({
        'data': [
          {
            ..._baseBooking,
            'isMobile': true,
            'customerAddress': 'تهران، میدان ونک',
            'customerLatitude': '35.7575',
            'customerLongitude': '51.4100',
          },
          {..._baseBooking, 'id': 'b2', 'isMobile': false},
        ],
        'total': 2,
        'page': 1,
        'limit': 50,
        'totalPages': 1,
        'counts': const {},
      });

      expect(page.data, hasLength(2));
      expect(page.data.first.isMobile, isTrue);
      expect(page.data.first.customerAddress, 'تهران، میدان ونک');
      expect(page.data.first.customerLatitude, 35.7575);
      expect(page.data.last.isMobile, isFalse);
    });
  });

  group('SalonSpecialist.fromJson', () {


    test('reads the travelling flag, defaulting to false when it is absent', () {
      const json = {
        'id': 's1',
        'userId': 'u1',
        'offersMobileService': true,
      };
      expect(SalonSpecialist.fromJson(json).offersMobileService, isTrue);
      expect(
        SalonSpecialist.fromJson(const {'id': 's2', 'userId': 'u2'}).offersMobileService,
        isFalse,
      );
    });
  });

  group('SalonService.fromJson', () {
    test('reads the mobile flag, defaulting to false when it is absent', () {
      const json = {
        'id': 'sv1',
        'lineId': 'l1',
        'name': 'کوتاهی مو',
        'price': 150000,
        'durationMinutes': 45,
        'isMobileAvailable': true,
      };
      expect(SalonService.fromJson(json).isMobileAvailable, isTrue);
      expect(
        SalonService.fromJson(const {'id': 'sv2', 'lineId': 'l1', 'name': 'رنگ'}).isMobileAvailable,
        isFalse,
      );
    });
  });

  group('SpecialistApi.updateSpecialist', () {
    test('sends only the travelling flag when that is all it was given', () async {
      final dio = Dio();
      final sent = <RequestOptions>[];
      dio.httpClientAdapter = _StubAdapter(_writeOk, sent);

      await SpecialistApi(dio).updateSpecialist('s1', offersMobileService: true);

      final request = sent.single;
      expect(request.method, 'PATCH');
      expect(request.path, '/salon/me/specialists/s1');
      // The backend whitelist keeps every other column; absent keys are "keep".
      expect(request.data, {'offersMobileService': true});
    });
  });

  group('ServicesApi.updateService', () {
    test('sends only the mobile flag when that is all it was given', () async {
      final dio = Dio();
      final sent = <RequestOptions>[];
      dio.httpClientAdapter = _StubAdapter(_writeOk, sent);

      await ServicesApi(dio).updateService('sv1', isMobileAvailable: false);

      final request = sent.single;
      expect(request.method, 'PATCH');
      expect(request.path, '/salon/me/services/sv1');
      expect(request.data, {'isMobileAvailable': false});
    });
  });

  group('BookingsApi', () {
    test('parses an on-site booking out of the detail endpoint', () async {
      final dio = Dio();
      final sent = <RequestOptions>[];
      dio.httpClientAdapter = _StubAdapter(
        {
          ..._baseBooking,
          'isMobile': true,
          'customerAddress': 'تهران، خیابان فرشته',
          'customerLatitude': '35.8000',
          'customerLongitude': '51.4500',
        },
        sent,
      );

      final detail = await BookingsApi(dio).getBooking('b1');

      expect(sent.single.path, '/salon/me/bookings/b1');
      expect(detail.summary.isMobile, isTrue);
      expect(detail.summary.customerAddress, 'تهران، خیابان فرشته');
      expect(detail.summary.customerLatitude, 35.8);
      expect(detail.summary.customerLongitude, 51.45);
    });
  });
}
