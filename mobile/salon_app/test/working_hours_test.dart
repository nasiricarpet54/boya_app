import 'package:flutter_test/flutter_test.dart';
import 'package:salon_app/features/salon/domain/working_hours.dart';

void main() {
  group('WorkingHours.fromJson', () {
    test('parses sat…fri days and defaults missing days to closed', () {
      final hours = WorkingHours.fromJson(const {
        'sat': {'active': true, 'start': '09:00', 'end': '21:00'},
        'fri': {'active': false},
      });

      expect(hours.days['sat']!.active, isTrue);
      expect(hours.days['sat']!.start, '09:00');
      expect(hours.days['fri']!.active, isFalse);
      // Absent keys render as closed, never crash the editor.
      expect(hours.days['sun']!.active, isFalse);
    });

    test('accepts the legacy open/close/closed shape', () {
      final hours = WorkingHours.fromJson(const {
        'sat': {'open': '08:00', 'close': '20:00', 'closed': false},
      });

      expect(hours.days['sat']!.start, '08:00');
      expect(hours.days['sat']!.end, '20:00');
      expect(hours.days['sat']!.active, isTrue);
    });
  });

  group('WorkingHours.toJson', () {
    test('emits closed days as active:false and drops empty titles', () {
      final hours = WorkingHours(
        days: {
          for (final key in WorkingHours.dayKeys)
            key: key == 'sat'
                ? const DaySchedule(
                    active: true,
                    start: '09:00',
                    end: '21:00',
                    breaks: [WorkingBreak(start: '12:00', end: '13:00')],
                  )
                : const DaySchedule(active: false),
        },
      );

      final json = hours.toJson();
      expect(
        json['sat'],
        {'active': true, 'start': '09:00', 'end': '21:00', 'breaks': [
          {'start': '12:00', 'end': '13:00'},
        ]},
      );
      expect(json['fri'], {'active': false});
    });
  });

  group('WorkingHours.validate', () {
    WorkingHours weekWith(String key, DaySchedule day) {
      final days = <String, DaySchedule>{
        for (final k in WorkingHours.dayKeys)
          k: const DaySchedule(active: false),
      };
      days[key] = day;
      return WorkingHours(days: days);
    }

    test('accepts a healthy week', () {
      final hours = weekWith(
        'sat',
        const DaySchedule(
          active: true,
          start: '09:00',
          end: '21:00',
          breaks: [WorkingBreak(start: '12:00', end: '13:00', title: 'ناهار')],
        ),
      );

      expect(hours.validate(), isEmpty);
    });

    test('rejects end before start and windows under 30 minutes', () {
      expect(
        weekWith('sat', const DaySchedule(active: true, start: '18:00', end: '09:00'))
            .validate()['sat'],
        isNotNull,
      );
      expect(
        weekWith('sat', const DaySchedule(active: true, start: '09:00', end: '09:20'))
            .validate()['sat'],
        contains('۳۰ دقیقه'),
      );
    });

    test('rejects breaks outside the window or overlapping', () {
      expect(
        weekWith(
          'sat',
          const DaySchedule(
            active: true,
            start: '09:00',
            end: '12:00',
            breaks: [WorkingBreak(start: '11:00', end: '13:00')],
          ),
        ).validate()['sat'],
        contains('داخل ساعت کاری'),
      );
      expect(
        weekWith(
          'sat',
          const DaySchedule(
            active: true,
            start: '09:00',
            end: '21:00',
            breaks: [
              WorkingBreak(start: '12:00', end: '13:00'),
              WorkingBreak(start: '12:30', end: '13:30'),
            ],
          ),
        ).validate()['sat'],
        contains('هم‌پوشانی'),
      );
    });
  });

  test('copySaturdayToAll stamps Saturday onto every other day', () {
    final hours = WorkingHours(
      days: {
        for (final key in WorkingHours.dayKeys)
          key: key == 'sat'
              ? const DaySchedule(
                  active: true,
                  start: '10:00',
                  end: '20:00',
                  breaks: [WorkingBreak(start: '13:00', end: '14:00')],
                )
              : const DaySchedule(active: false),
      },
    );

    final copied = hours.copySaturdayToAll();
    expect(copied.days['sun']!.start, '10:00');
    expect(copied.days['fri']!.breaks.single.start, '13:00');
  });
}
