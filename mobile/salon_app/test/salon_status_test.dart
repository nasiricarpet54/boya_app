import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_app/features/salon/data/salon_api.dart';
import 'package:salon_app/features/salon/domain/salon_status.dart';

/// An api bound to a [Dio] whose adapter answers [body], so the request line
/// and payload can be asserted without a server.
class _StubApi {
  _StubApi(this.api, this.sent);

  final SalonApi api;

  /// The last request the api issued.
  final List<RequestOptions> sent;
}

_StubApi _apiAnswering(Map<String, dynamic> body) {
  final dio = Dio();
  final sent = <RequestOptions>[];
  dio.httpClientAdapter = _StubAdapter(body, sent);
  return _StubApi(SalonApi(dio), sent);
}

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this._body, this._sent);

  final Map<String, dynamic> _body;
  final List<RequestOptions> _sent;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    _sent.add(options);
    return ResponseBody.fromString(
      jsonEncode(_body),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  group('SalonApprovalStatus.fromWire', () {
    test('maps the snake_case wire values the API actually sends', () {
      expect(SalonApprovalStatus.fromWire('pending_approval'), SalonApprovalStatus.pendingApproval);
      expect(SalonApprovalStatus.fromWire('draft'), SalonApprovalStatus.draft);
      expect(SalonApprovalStatus.fromWire('approved'), SalonApprovalStatus.approved);
      expect(SalonApprovalStatus.fromWire('rejected'), SalonApprovalStatus.rejected);
      expect(SalonApprovalStatus.fromWire('suspended'), SalonApprovalStatus.suspended);
    });

    test('falls back to draft for an unknown or missing value', () {
      // A status added to the backend enum must not crash the panel.
      expect(SalonApprovalStatus.fromWire('archived'), SalonApprovalStatus.draft);
      expect(SalonApprovalStatus.fromWire(null), SalonApprovalStatus.draft);
    });
  });

  group('SalonStatusInfo', () {
    test('is settled only when approved with nothing queued', () {
      expect(
        const SalonStatusInfo(status: SalonApprovalStatus.approved, hasPendingChanges: false).isSettled,
        isTrue,
      );
      // Approved but edited again: the banner must still show.
      expect(
        const SalonStatusInfo(status: SalonApprovalStatus.approved, hasPendingChanges: true).isSettled,
        isFalse,
      );
      expect(
        const SalonStatusInfo(status: SalonApprovalStatus.rejected, hasPendingChanges: false).isSettled,
        isFalse,
      );
    });

    test('normalises a blank rejection reason to null so no separator dangles', () {
      expect(
        SalonStatusInfo.fromJson(const {
          'status': 'rejected',
          'rejectionReason': '   ',
          'hasPendingChanges': false,
        }).rejectionReason,
        isNull,
      );
      expect(
        SalonStatusInfo.fromJson(const {
          'status': 'rejected',
          'rejectionReason': '  نام نامعتبر است  ',
          'hasPendingChanges': false,
        }).rejectionReason,
        'نام نامعتبر است',
      );
    });

    test('defaults hasPendingChanges to false when the key is absent', () {
      expect(
        SalonStatusInfo.fromJson(const {'status': 'approved'}).hasPendingChanges,
        isFalse,
      );
    });
  });

  group('SalonApi.patchSalon', () {
    test('sends only the fields it was given, so pending fields survive', () async {
      final stub = _apiAnswering(const {
        'status': 'pending_approval',
        'message': 'در انتظار تایید ادمین',
      });

      final status = await stub.api.patchSalon(name: 'نگین جدید');

      expect(status, SalonApprovalStatus.pendingApproval);
      final request = stub.sent.single;
      expect(request.method, 'PATCH');
      expect(request.path, '/salon/me');
      // The backend merges jsonb, so an absent key means "leave pending as is".
      expect(request.data, {'name': 'نگین جدید'});
    });

    test('carries every supplied field through to the body', () async {
      final stub = _apiAnswering(const {'status': 'pending_approval'});

      await stub.api.patchSalon(
        name: 'نگین',
        address: 'تهران',
        phone: '09130000028',
        coverImage: 'https://cdn.boya.ir/cover.jpg',
        workingHours: const {
          'saturday': {'active': true},
        },
      );

      expect(stub.sent.single.data, {
        'name': 'نگین',
        'address': 'تهران',
        'phone': '09130000028',
        'coverImage': 'https://cdn.boya.ir/cover.jpg',
        'workingHours': {
          'saturday': {'active': true},
        },
      });
    });

    test('throws when the API answers without queueing the edit', () async {
      final stub = _apiAnswering(const {'status': 'approved'});

      // Claiming success here would tell the salon its change is live.
      await expectLater(
        stub.api.patchSalon(name: 'نگین'),
        throwsA(isA<SalonEditNotQueuedException>()),
      );
    });
  });
}