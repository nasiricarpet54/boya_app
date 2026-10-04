import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AvailabilityService, WorkingHours } from '../src/modules/booking/availability.service';

const hours: WorkingHours = {
  sat: { start: '09:00', end: '21:00', active: true },
  fri: { start: '10:00', end: '18:00', active: false },
};

describe('AvailabilityService', () => {
  const service = new AvailabilityService();

  test('Friday is closed unless marked active', () => {
    const slots = service.generateSlots({
      workingHours: hours,
      date: new Date(2026, 9, 16, 12),
      durationMinutes: 60,
    });
    assert.equal(slots.length, 0);
  });

  test('Saturday yields twelve hourly slots', () => {
    const slots = service.generateSlots({
      workingHours: hours,
      date: new Date(2026, 9, 17, 12),
      durationMinutes: 60,
      stepMinutes: 60,
    });
    assert.equal(slots.length, 12);
  });

  test('an overlapping busy range removes one slot', () => {
    const date = new Date(2026, 9, 17, 12);
    const candidates = service.generateSlots({
      workingHours: hours,
      date,
      durationMinutes: 60,
      stepMinutes: 60,
    });
    const available = service.filterAvailable(candidates, [
      { start: new Date(2026, 9, 17, 10), end: new Date(2026, 9, 17, 11) },
    ]);
    assert.equal(available.length, 11);
  });

  test('zero duration is rejected', () => {
    assert.throws(
      () => service.generateSlots({ workingHours: hours, date: new Date(2026, 9, 17), durationMinutes: 0 }),
      /مدت زمان/,
    );
  });
});
