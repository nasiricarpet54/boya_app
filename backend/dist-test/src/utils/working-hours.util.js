"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SLOT_STEP_MINUTES = exports.MINUTES_PER_DAY = exports.WEEK_DAY_KEYS = void 0;
exports.parseTimeOfDay = parseTimeOfDay;
exports.parseDayWindow = parseDayWindow;
exports.dayWindow = dayWindow;
exports.dayKeyForInstant = dayKeyForInstant;
exports.dayKeyForCivilDate = dayKeyForCivilDate;
exports.minutesSinceMidnight = minutesSinceMidnight;
exports.withinWindow = withinWindow;
exports.windowFits = windowFits;
exports.slotStarts = slotStarts;
exports.isOpenFor = isOpenFor;
exports.formatClock = formatClock;
const jalali_date_util_1 = require("./jalali-date.util");
const persian_number_util_1 = require("./persian-number.util");
exports.WEEK_DAY_KEYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
exports.MINUTES_PER_DAY = 24 * 60;
exports.DEFAULT_SLOT_STEP_MINUTES = 30;
function parseTimeOfDay(value) {
    if (typeof value !== 'string')
        return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match)
        return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0))
        return null;
    return hours * 60 + minutes;
}
function parseDayWindow(entry) {
    if (entry === null || entry === undefined || typeof entry !== 'object')
        return null;
    const day = entry;
    if (day.active === false || day.closed === true)
        return null;
    const open = parseTimeOfDay(day.start ?? day.open);
    const close = parseTimeOfDay(day.end ?? day.close);
    if (open === null || close === null || open === close)
        return null;
    return { open, close };
}
function dayWindow(workingHours, key) {
    if (workingHours === null || workingHours === undefined || typeof workingHours !== 'object') {
        return null;
    }
    return parseDayWindow(workingHours[key]);
}
function dayKeyForInstant(instant) {
    return exports.WEEK_DAY_KEYS[(0, jalali_date_util_1.jalaliWeekdayIndex)(instant)];
}
function dayKeyForCivilDate(date) {
    const noonUtc = new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
    return exports.WEEK_DAY_KEYS[(0, jalali_date_util_1.jalaliWeekdayIndex)(noonUtc)];
}
function minutesSinceMidnight(instant) {
    const [hours, minutes] = (0, jalali_date_util_1.formatJalaliTime)(instant).split(':').map(persian_number_util_1.toLatinDigits);
    return Number(hours) * 60 + Number(minutes);
}
function withinWindow(window, minute) {
    return window.close > window.open
        ? minute >= window.open && minute < window.close
        : minute >= window.open || minute < window.close;
}
function windowFits(window, startMinute, durationMinutes, dayOffset = 0) {
    const start = startMinute + dayOffset * exports.MINUTES_PER_DAY;
    const end = start + durationMinutes;
    if (window.close > window.open) {
        return start >= window.open && end <= window.close;
    }
    const evening = start >= window.open && end <= window.close + exports.MINUTES_PER_DAY;
    const smallHours = dayOffset === 0 && start < window.close && end <= window.close;
    return evening || smallHours;
}
function slotStarts(window, durationMinutes, stepMinutes = exports.DEFAULT_SLOT_STEP_MINUTES) {
    if (durationMinutes <= 0 || stepMinutes <= 0)
        return [];
    const closes = window.close > window.open ? window.close : window.close + exports.MINUTES_PER_DAY;
    const starts = [];
    for (let start = window.open; start + durationMinutes <= closes; start += stepMinutes) {
        if (start >= exports.MINUTES_PER_DAY)
            break;
        starts.push(start);
    }
    return starts;
}
function isOpenFor(workingHours, instant, durationMinutes) {
    const minute = minutesSinceMidnight(instant);
    const today = dayWindow(workingHours, dayKeyForInstant(instant));
    if (today && windowFits(today, minute, durationMinutes))
        return true;
    const yesterdayInstant = new Date(instant.getTime() - exports.MINUTES_PER_DAY * 60_000);
    const yesterday = dayWindow(workingHours, dayKeyForInstant(yesterdayInstant));
    return yesterday !== null && windowFits(yesterday, minute, durationMinutes, 1);
}
function formatClock(minute) {
    const wrapped = ((minute % exports.MINUTES_PER_DAY) + exports.MINUTES_PER_DAY) % exports.MINUTES_PER_DAY;
    const hours = Math.floor(wrapped / 60);
    const minutes = wrapped % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
