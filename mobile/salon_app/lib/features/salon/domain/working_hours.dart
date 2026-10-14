/// Weekly working hours of a salon, as stored in `tenants.working_hours`.
///
/// Keys are Jalali-order day codes `sat`…`fri` (Saturday opens the week,
/// Friday is the weekend), matching `working-hours.util` on the backend.
/// Each day is sent verbatim to `PATCH /salon/me/schedule` inside
/// `{ workingHours: ... }` and staged in `pending_changes` until an admin
/// approves — nothing here goes live on save.
class WorkingBreak {
  const WorkingBreak({
    required this.start,
    required this.end,
    this.title = '',
  });

  factory WorkingBreak.fromJson(Map<String, dynamic> json) => WorkingBreak(
        start: json['start'] as String? ?? '12:00',
        end: json['end'] as String? ?? '13:00',
        title: json['title'] as String? ?? '',
      );

  /// Start time as `HH:MM` (24h).
  final String start;

  /// End time as `HH:MM` (24h).
  final String end;

  /// Optional label shown on the booking wall, e.g. «ناهار».
  final String title;

  WorkingBreak copyWith({String? start, String? end, String? title}) =>
      WorkingBreak(
        start: start ?? this.start,
        end: end ?? this.end,
        title: title ?? this.title,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'start': start,
        'end': end,
        if (title.trim().isNotEmpty) 'title': title.trim(),
      };
}

/// One day of the weekly schedule.
class DaySchedule {
  const DaySchedule({
    required this.active,
    this.start = '09:00',
    this.end = '21:00',
    this.breaks = const <WorkingBreak>[],
  });

  factory DaySchedule.fromJson(Map<String, dynamic> json) {
    final breaksJson = json['breaks'];
    return DaySchedule(
      // Legacy seeds wrote `{ open, close, closed }`; still accepted.
      active: (json['active'] as bool?) ??
          !((json['closed'] as bool?) ?? false),
      start: (json['start'] ?? json['open']) as String? ?? '09:00',
      end: (json['end'] ?? json['close']) as String? ?? '21:00',
      breaks: breaksJson is List
          ? <WorkingBreak>[
              for (final item in breaksJson)
                if (item is Map<String, dynamic>)
                  WorkingBreak.fromJson(item)
                else if (item is Map)
                  WorkingBreak.fromJson(Map<String, dynamic>.from(item)),
            ]
          : const <WorkingBreak>[],
    );
  }

  /// `false` renders as «تعطیل» and skips every validation rule.
  final bool active;

  /// Opening time as `HH:MM` (24h).
  final String start;

  /// Closing time as `HH:MM` (24h).
  final String end;

  /// Intra-day pauses, e.g. lunch. Must sit inside [start]–[end].
  final List<WorkingBreak> breaks;

  DaySchedule copyWith({
    bool? active,
    String? start,
    String? end,
    List<WorkingBreak>? breaks,
  }) =>
      DaySchedule(
        active: active ?? this.active,
        start: start ?? this.start,
        end: end ?? this.end,
        breaks: breaks ?? this.breaks,
      );

  Map<String, dynamic> toJson() {
    if (!active) return <String, dynamic>{'active': false};
    return <String, dynamic>{
      'active': true,
      'start': start,
      'end': end,
      if (breaks.isNotEmpty)
        'breaks': <Map<String, dynamic>>[for (final b in breaks) b.toJson()],
    };
  }
}


/// The whole week, keyed `sat`…`fri` in Jalali order.
class WorkingHours {
  const WorkingHours({required this.days});

  /// A week where every day is closed; the editor seeds over it.
  factory WorkingHours.closed() => WorkingHours(
        days: <String, DaySchedule>{
          for (final key in WorkingHours.dayKeys)
            key: const DaySchedule(active: false),
        },
      );

  factory WorkingHours.fromJson(Map<String, dynamic> json) {
    final days = <String, DaySchedule>{};
    for (final key in WorkingHours.dayKeys) {
      final entry = json[key];
      if (entry is Map<String, dynamic>) {
        days[key] = DaySchedule.fromJson(entry);
      } else if (entry is Map) {
        days[key] = DaySchedule.fromJson(Map<String, dynamic>.from(entry));
      } else {
        days[key] = const DaySchedule(active: false);
      }
    }
    return WorkingHours(days: days);
  }

  /// Jalali order: Saturday opens the week, Friday is the weekend.
  static const List<String> dayKeys = <String>[
    'sat',
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
  ];

  /// Persian labels, Saturday first. Used by the editor only.
  static const Map<String, String> dayLabels = <String, String>{
    'sat': 'شنبه',
    'sun': 'یکشنبه',
    'mon': 'دوشنبه',
    'tue': 'سه‌شنبه',
    'wed': 'چهارشنبه',
    'thu': 'پنجشنبه',
    'fri': 'جمعه',
  };

  /// Minimum bookable window per active day, in minutes.
  static const int minWindowMinutes = 30;

  final Map<String, DaySchedule> days;

  WorkingHours copyWithDay(String key, DaySchedule day) {
    final next = Map<String, DaySchedule>.of(days);
    next[key] = day;
    return WorkingHours(days: next);
  }

  /// Saturday's schedule stamped onto every other day.
  WorkingHours copySaturdayToAll() {
    final saturday = days['sat'] ?? const DaySchedule(active: false);
    final next = <String, DaySchedule>{};
    for (final key in dayKeys) {
      next[key] = key == 'sat'
          ? saturday
          : DaySchedule(
              active: saturday.active,
              start: saturday.start,
              end: saturday.end,
              breaks: <WorkingBreak>[
                for (final b in saturday.breaks) b.copyWith(),
              ],
            );
    }
    return WorkingHours(days: next);
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        for (final key in dayKeys)
          if (days[key] != null) key: days[key]!.toJson(),
      };

  /// `HH:MM` → minutes since midnight, or `null` when malformed.
  static int? minutesOf(String value) {
    final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value.trim());
    if (match == null) return null;
    final hours = int.parse(match.group(1)!);
    final minutes = int.parse(match.group(2)!);
    if (hours > 24 || minutes > 59 || (hours == 24 && minutes > 0)) {
      return null;
    }
    return hours * 60 + minutes;
  }

  /// Persian error per day key, empty when the whole week is valid.
  Map<String, String> validate() {
    final errors = <String, String>{};
    for (final key in dayKeys) {
      final day = days[key];
      if (day == null || !day.active) continue;
      final error = _validateDay(day);
      if (error != null) errors[key] = error;
    }
    return errors;
  }

  String? _validateDay(DaySchedule day) {
    final start = minutesOf(day.start);
    final end = minutesOf(day.end);
    if (start == null || end == null) {
      return 'ساعت شروع یا پایان معتبر نیست';
    }
    if (start >= end) {
      return 'ساعت پایان باید بعد از ساعت شروع باشد';
    }
    if (end - start < minWindowMinutes) {
      return 'ساعت کاری هر روز حداقل ۳۰ دقیقه باشد';
    }
    final ranges = <_Range>[];
    for (final b in day.breaks) {
      final breakStart = minutesOf(b.start);
      final breakEnd = minutesOf(b.end);
      if (breakStart == null || breakEnd == null || breakStart >= breakEnd) {
        return 'ساعت وقفه معتبر نیست';
      }
      if (breakStart < start || breakEnd > end) {
        return 'وقفه باید داخل ساعت کاری باشد';
      }
      ranges.add(_Range(breakStart, breakEnd));
    }
    ranges.sort((a, b) => a.start.compareTo(b.start));
    for (var i = 1; i < ranges.length; i++) {
      if (ranges[i].start < ranges[i - 1].end) {
        return 'وقفه‌ها نباید هم‌پوشانی داشته باشند';
      }
    }
    return null;
  }
}

class _Range {
  const _Range(this.start, this.end);

  final int start;
  final int end;
}
