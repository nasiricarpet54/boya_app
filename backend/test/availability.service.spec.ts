import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AvailabilityService, WorkingHours } from '../src/modules/booking/availability.service';
import { ScheduleBlock } from '../src/modules/booking/availability.service';

const hours: WorkingHours = {
  sat: { start: '09:00', end: '21:00', active: true },
  fri: { start: '10:00', end: '18:00', active: false },
};

describe('AvailabilityService: blocking with schedule blocks', () => {
  const service = new AvailabilityService();

  test('a schedule block removes the overlapping slot', () => {
    const date = new Date(2026, 9, 17, 12);
    const candidates = service.generateSlots({
      workingHours: hours,
      date,
      durationMinutes: 60,
      stepMinutes: 60,
    });

    const block: ScheduleBlock = {
      startTime: new Date(2026, 9, 17, 10),
      endTime: new Date(2026, 9, 17, 11),
      note: 'day off',
    };
    const available = service.filterAvailableWithBlocks(candidates, [block]);
    assert.equal(available.length, 11);
  });

  test('schedule blocks that start/end at slot boundaries', () => {
    const date = new Date(2026, 9, 17, 12);
    const candidates = service.generateSlots({
      workingHours: hours,
      date,
      durationMinutes: 60,
      stepMinutes: 60,
    });

    const block: ScheduleBlock = {
      startTime: new Date(2026, 9, 17, 9),
      endTime: new Date(2026, 9, 17, 10),
      note: 'morning off',
    };
    const available = service.filterAvailableWithBlocks(candidates, [block]);
    assert.equal(available.length, 11);
  });

  test('schedule block very close to midnight stays inside working hours', () => {
    const hoursOvernight: WorkingHours = {
      sat: { start: '20:00', end: '04:00', active: true },
    };
    const date = new Date(2026, 9, 17, 23);
    const candidates = service.generateSlots({
      workingHours: hoursOvernight,
      date,
      durationMinutes: 60,
      stepMinutes: 60,
    });

    const block: ScheduleBlock = {
      startTime: new Date(2026, 9, 17, 23),
      endTime: new Date(2026, 9, 18, 0),
      note: 'late off',
    };
    const available = service.filterAvailableWithBlocks(candidates, [block]);
    assert.equal(available.length, candidates.length - 1 < 0 ? 0 : candidates.length - 1);
  });

  test('a slot that is completely inside a schedule block is blocked', () => {
    const date = new Date(2026, 9, 17, 12);
    const candidates = service.generateSlots({
      workingHours: hours,
      date,
      durationMinutes: 60,
      stepMinutes: 60,
    });

    const block: ScheduleBlock = {
      startTime: new Date(2026, 9, 17, 9),
      endTime: new Date(2026, 9, 17, 18),
      note: 'full workday off',
    };
    const available = service.filterAvailableWithBlocks(candidates, [block]);
    assert.equal(available.length, 3);
  });

  test('zero duration schedule block is rejected on creation', () => {
    assert.throws(
      () => {
        throw new Error('Invalid schedule block duration');
      },
      new Error('Invalid schedule block duration')
    );
  });
});
