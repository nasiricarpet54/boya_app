import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// `GET /support/tickets` / `POST /support/tickets` — one row of the customer's
/// own support history.
///
/// `adminResponse` is only present once staff has replied, so it is nullable and
/// the detail screen treats its absence as "پاسخ هنوز ثبت نشده".
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.type,
    required this.subject,
    required this.message,
    required this.status,
    required this.priority,
    required this.createdAt,
    this.bookingId,
    this.salonId,
    this.adminResponse,
    this.respondedAt,
  });

  /// Parses one ticket row. Fields the app does not use (`respondedBy`) are
  /// dropped, and missing optional fields default to `null` rather than
  /// throwing — a malformed row must not break the list.
  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      id: (json['id'] as String?) ?? '',
      type: (json['type'] as String?) ?? 'question',
      subject: (json['subject'] as String?) ?? '',
      message: (json['message'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'open',
      priority: (json['priority'] as String?) ?? 'medium',
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      bookingId: json['bookingId'] as String?,
      salonId: json['salonId'] as String?,
      adminResponse: json['adminResponse'] as String?,
      respondedAt: _parseDate(json['respondedAt']),
    );
  }

  final String id;

  /// Mirrors the backend `TicketType` enum.
  final String type;
  final String subject;
  final String message;

  /// Mirrors the backend `TicketStatus` enum.
  final String status;
  final String priority;
  final DateTime createdAt;

  /// Optional context ids. Shown only as presence, never resolved to names in
  /// the app — the list does not fetch bookings/salons to label a ticket row.
  final String? bookingId;
  final String? salonId;

  /// Staff reply; `null` until the ticket is answered.
  final String? adminResponse;
  final DateTime? respondedAt;

  /// Persian label for [type], for the chip on each row.
  String get typeLabel => switch (type) {
        'complaint' => 'شکایت',
        'suggestion' => 'پیشنهاد',
        'question' => 'سوال',
        _ => 'دیگر',
      };

  /// Persian label for [status].
  String get statusLabel => switch (status) {
        'answered' => 'پاسخ داده شده',
        'closed' => 'بسته شده',
        _ => 'در حال بررسی',
      };

  /// Coloured chip tone for [status]: answered is the only state the customer
  /// can act on (read the reply), so it is the one that gets `success`.
  Color get statusTone => switch (status) {
        'answered' => BoyaColors.success,
        'closed' => BoyaColors.inkMuted,
        _ => BoyaColors.warning,
      };

  bool get hasReply => (adminResponse ?? '').trim().isNotEmpty;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}
