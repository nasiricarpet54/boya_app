/// One in-app notification row, as `GET /notifications` returns it.
///
/// The API answers with the entity as stored, so the keys are camelCase and
/// `createdAt` is an ISO-8601 instant; the list screen turns it into a relative
/// label ("۵ دقیقه پیش") at the presentation layer.
class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    this.data = const <String, dynamic>{},
  });

  final String id;

  /// One of the backend `NotificationType` values, kept as text: a new type
  /// must not crash an older build, so unknown ones fall back to a default row.
  final String type;

  final String title;

  final String body;

  /// `bookingId`, `referralId` and friends. Drives navigation on tap.
  final Map<String, dynamic> data;

  final bool isRead;

  final DateTime createdAt;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return NotificationItem(
      id: '${json['id']}',
      type: '${json['type'] ?? ''}',
      title: '${json['title'] ?? ''}',
      body: '${json['body'] ?? ''}',
      isRead: json['isRead'] == true,
      createdAt: _parseInstant('${json['createdAt'] ?? ''}'),
      data: raw is Map<String, dynamic> ? raw : const <String, dynamic>{},
    );
  }
}

/// The API stores UTC instants; an unparseable value degrades to the epoch
/// rather than throwing, so one bad row cannot blank the whole list.
DateTime _parseInstant(String value) {
  final parsed = DateTime.tryParse(value);
  return parsed?.toLocal() ?? DateTime.fromMillisecondsSinceEpoch(0);
}