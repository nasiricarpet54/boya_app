import 'dart:convert';
import 'dart:typed_data';

import 'package:customer_app/features/support/data/faq_content.dart';
import 'package:customer_app/features/support/data/support_api.dart';
import 'package:customer_app/features/support/data/support_ticket.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Same scriptable-adapter pattern as `city_picker_test.dart`: no network, and
/// the request the client *builds* is recorded so the create body is observable.

typedef _Responder = ResponseBody Function(RequestOptions options);

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this._routes, this._requests);

  final Map<String, _Responder> _routes;
  final List<RequestOptions> _requests;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    _requests.add(options);
    final respond = _routes[options.path];
    if (respond == null) {
      return _json({'message': 'route not stubbed: ${options.path}'}, 404);
    }
    return respond(options);
  }
}

ResponseBody _json(Object body, [int status = 200]) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});

SupportApi _api(List<RequestOptions> requests, Map<String, _Responder> routes) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
  dio.httpClientAdapter = _StubAdapter(routes, requests);
  return SupportApi(dio);
}

void main() {
  group('SupportTicket.fromJson', () {
    test('reads the fields the detail screen renders', () {
      final ticket = SupportTicket.fromJson({
        'id': 't1',
        'type': 'complaint',
        'subject': 'کیفیت خدمات',
        'message': 'مراجعه شما حساب کمتری داشت',
        'status': 'answered',
        'priority': 'high',
        'createdAt': '2026-10-13T09:00:00.000Z',
        'bookingId': 'b1',
        'salonId': 's1',
        'adminResponse': 'پیگیری می‌شود',
        'respondedAt': '2026-10-13T10:00:00.000Z',
        // The row carries ids the app does not resolve to names; they must be
        // ignored rather than breaking the parse.
        'respondedBy': 'admin-1',
      });

      expect(ticket.id, 't1');
      expect(ticket.subject, 'کیفیت خدمات');
      expect(ticket.statusLabel, 'پاسخ داده شده');
      expect(ticket.typeLabel, 'شکایت');
      expect(ticket.hasReply, isTrue);
    });

    test('treats an unanswered row as reply-less, not as a parse failure', () {
      final ticket = SupportTicket.fromJson({
        'id': 't2',
        'type': 'question',
        'subject': 'اعتبار',
        'message': 'چطور شارژ کنم؟',
        'status': 'open',
        'priority': 'medium',
        'createdAt': '2026-10-13T09:00:00.000Z',
      });

      expect(ticket.hasReply, isFalse);
      expect(ticket.statusLabel, 'در حال بررسی');
      expect(ticket.bookingId, isNull);
      expect(ticket.salonId, isNull);
      expect(ticket.respondedAt, isNull);
    });

    test('maps an unknown status to the reviewing label', () {
      final ticket = SupportTicket.fromJson({'id': 't3', 'status': 'in_review'});

      expect(ticket.statusLabel, 'در حال بررسی');
    });
  });

  group('SupportApi.createTicket', () {
    test('posts the body to /support/tickets', () async {
      final requests = <RequestOptions>[];
      final api = _api(requests, {
        '/support/tickets': (_) => _json({'id': 't1', 'status': 'open'}),
      });

      final ticket = await api.createTicket(
        type: 'complaint',
        subject: 'کیفیت خدمات',
        message: 'مراجعه شما حساب کمتری داشت',
      );

      expect(requests, hasLength(1));
      expect(requests.first.method, 'POST');
      expect(requests.first.path, '/support/tickets');
      expect(requests.first.data, {
        'type': 'complaint',
        'subject': 'کیفیت خدمات',
        'message': 'مراجعه شما حساب کمتری داشت',
      });
      expect(ticket.id, 't1');
    });

    test('omits optional context instead of sending nulls', () async {
      final requests = <RequestOptions>[];
      final api = _api(requests, {
        '/support/tickets': (_) => _json({'id': 't1', 'status': 'open'}),
      });

      await api.createTicket(
        type: 'question',
        subject: 'اعتبار',
        message: 'چطور می‌توانم شارژ کنم؟',
        bookingId: 'b1',
      );

      // `salonId` was not passed, so it is absent — not `null`. The server
      // treats absent as "unset" and the row stays honest about its context.
      expect(requests.first.data, {
        'type': 'question',
        'subject': 'اعتبار',
        'message': 'چطور می‌توانم شارژ کنم؟',
        'bookingId': 'b1',
      });
      expect(requests.first.data, isNot(contains('salonId')));
    });

    test('throws on a non-object response', () async {
      final api = _api(<RequestOptions>[], {
        '/support/tickets': (_) => _json(['not', 'an', 'object']),
      });

      await expectLater(
        api.createTicket(type: 'other', subject: 'abc', message: 'ten chars'),
        throwsA(isA<DioException>()),
      );
    });
  });

  group('SupportApi.listMine', () {
    test('reads the { data: [] } envelope the endpoint answers', () async {
      final requests = <RequestOptions>[];
      final api = _api(requests, {
        '/support/tickets': (_) => _json({
          'data': [
            {'id': 't1', 'subject': 'اول'},
            {'id': 't2', 'subject': 'دوم'},
          ],
        }),
      });

      final tickets = await api.listMine();

      expect(requests.first.method, 'GET');
      expect(tickets.map((element) => element.id), ['t1', 't2']);
    });

    test('returns an empty list when the envelope has no rows', () async {
      final api = _api(<RequestOptions>[], {
        '/support/tickets': (_) => _json({'data': []}),
      });

      expect(await api.listMine(), isEmpty);
    });
  });

  group('FaqContent', () {
    test('parses the bundled faq.json', () async {
      // `FaqContent.load()` reads `rootBundle`, which the test binding serves
      // from the pubspec asset manifest — the same declaration the shipped app
      // uses, so this pins the bundle path as well as the shape.
      TestWidgetsFlutterBinding.ensureInitialized();

      final categories = await FaqContent.load();

      expect(categories, isNotEmpty);
      for (final category in categories) {
        expect(category.title, isNotEmpty);
        expect(category.questions, isNotEmpty);
        for (final item in category.questions) {
          expect(item.question, isNotEmpty);
          expect(item.answer, isNotEmpty);
        }
      }
    });
  });
}
