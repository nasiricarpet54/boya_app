"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityService = void 0;
const DAY_KEY = {
    6: 'sat',
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
};
class AvailabilityService {
    generateSlots(input) {
        const { workingHours, date, durationMinutes, stepMinutes = 30 } = input;
        if (durationMinutes <= 0)
            throw new Error('مدت زمان خدمت باید بیشتر از صفر باشد');
        const day = workingHours[DAY_KEY[date.getDay()]];
        if (!day?.active)
            return [];
        const open = this.at(date, day.start);
        const close = this.at(date, day.end);
        if (close <= open)
            return [];
        const slots = [];
        const step = stepMinutes * 60_000;
        const length = durationMinutes * 60_000;
        for (let cursor = open.getTime(); cursor + length <= close.getTime(); cursor += step) {
            slots.push({ start: new Date(cursor), end: new Date(cursor + length) });
        }
        return slots;
    }
    filterAvailable(candidates, busy) {
        return candidates.filter((slot) => busy.every((item) => slot.end <= item.start || slot.start >= item.end));
    }
    isFriday(date) {
        return date.getDay() === 5;
    }
    at(date, hhmm) {
        const [hour, minute] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
        const result = new Date(date);
        result.setHours(hour || 0, minute || 0, 0, 0);
        return result;
    }
}
exports.AvailabilityService = AvailabilityService;
