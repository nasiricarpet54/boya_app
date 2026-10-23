export interface DayHours {
  start: string;
  end: string;
  active: boolean;
}

export interface WorkingHours {
  sat?: DayHours;
  sun?: DayHours;
  mon?: DayHours;
  tue?: DayHours;
  wed?: DayHours;
  thu?: DayHours;
  fri?: DayHours;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface ScheduleBlock {
  startTime: Date;
  endTime: Date;
  note?: string;
  categoryId?: string; // optional linking to some category
}

export interface GenerateSlotsInput {
  workingHours: WorkingHours;
  date: Date;
  durationMinutes: number;
  stepMinutes?: number;
}

const DAY_KEY: Record<number, keyof WorkingHours> = {
  6: 'sat',
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
};

/** Slot math only. Friday is closed unless that day is explicitly active. */
export class AvailabilityService {
  generateSlots(input: GenerateSlotsInput): TimeSlot[] {
    const { workingHours, date, durationMinutes, stepMinutes = 30 } = input;
    if (durationMinutes <= 0) throw new Error('مدت زمان خدمت باید بیشتر از صفر باشد');

    const day = workingHours[DAY_KEY[date.getDay()]];
    if (!day?.active) return [];

    const open = this.at(date, day.start);
    const close = this.at(date, day.end);
    if (close <= open) return [];

    const slots: TimeSlot[] = [];
    const step = stepMinutes * 60_000;
    const length = durationMinutes * 60_000;
    for (let cursor = open.getTime(); cursor + length <= close.getTime(); cursor += step) {
      slots.push({ start: new Date(cursor), end: new Date(cursor + length) });
    }
    return slots;
  }

  filterAvailable(candidates: TimeSlot[], busy: TimeSlot[]): TimeSlot[] {
    return candidates.filter((slot) => busy.every((item) => slot.end <= item.start || slot.start >= item.end));
  }

  isFriday(date: Date): boolean {
    return date.getDay() === 5;
  }

  filterAvailableWithBlocks(candidates: TimeSlot[], blocks: ScheduleBlock[]): TimeSlot[] {
    const blockTimes: TimeSlot[] = blocks.map(b => ({ start: b.startTime, end: b.endTime }));
    return this.filterAvailable(candidates, blockTimes);
  }

  private at(date: Date, hhmm: string): Date {
    const [hour, minute] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
    const result = new Date(date);
    result.setHours(hour || 0, minute || 0, 0, 0);
    return result;
  }
}
