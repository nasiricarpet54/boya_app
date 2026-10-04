"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jalaliWeekdayIndex = jalaliWeekdayIndex;
exports.isFriday = isFriday;
exports.formatJalaliDate = formatJalaliDate;
exports.formatJalaliTime = formatJalaliTime;
exports.formatJalaliDateTime = formatJalaliDateTime;
exports.toJalali = toJalali;
exports.formatJalaliLatin = formatJalaliLatin;
exports.startOfTehranDay = startOfTehranDay;
exports.startOfTehranWeek = startOfTehranWeek;
exports.endOfTehranWeek = endOfTehranWeek;
const date_fns_jalali_1 = require("date-fns-jalali");
const persian_number_util_1 = require("./persian-number.util");
const TEHRAN_TIME_ZONE = 'Asia/Tehran';
const SATURDAY_WEEKDAY = 6;
const DAYS_IN_WEEK = 7;
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const MILLESECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLESECONDS_PER_WEEK = 7 * MILLESECONDS_PER_DAY;
const SEARCH_STEP_MS = 15 * 60 * 1000;
const MAX_SEARCH_STEPS = 12;
function jalaliWeekdayIndex(date) {
    return (weekdayInTehran(date) - SATURDAY_WEEKDAY + DAYS_IN_WEEK) % DAYS_IN_WEEK;
}
function isFriday(date) {
    return (0, date_fns_jalali_1.isFriday)(tehranWallClock(date));
}
function formatJalaliDate(date) {
    const { year, month, day } = toJalali(date);
    return (0, persian_number_util_1.toPersianDigits)(`${year}/${month}/${day}`);
}
function formatJalaliTime(date) {
    const { hour, minute } = tehranTime(date);
    return (0, persian_number_util_1.toPersianDigits)(`${pad2(hour)}:${pad2(minute)}`);
}
function formatJalaliDateTime(date) {
    return `${formatJalaliDate(date)}، ${formatJalaliTime(date)}`;
}
function toJalali(date) {
    const wallClock = tehranWallClock(date);
    return {
        year: (0, date_fns_jalali_1.getYear)(wallClock),
        month: (0, date_fns_jalali_1.getMonth)(wallClock) + 1,
        day: (0, date_fns_jalali_1.getDate)(wallClock),
    };
}
function formatJalaliLatin(date) {
    return (0, date_fns_jalali_1.format)(tehranWallClock(date), 'yyyy/M/d');
}
function startOfTehranDay(date) {
    const wall = tehranWallClock(date);
    const guess = new Date(Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate()) - TEHRAN_OFFSET_MS);
    if (onTehranMidnight(guess) && sameCivilDay(tehranWallClock(guess), wall))
        return guess;
    for (let step = 1; step <= MAX_SEARCH_STEPS; step++) {
        for (const delta of [step * SEARCH_STEP_MS, -step * SEARCH_STEP_MS]) {
            const candidate = new Date(guess.getTime() + delta);
            if (onTehranMidnight(candidate) && sameCivilDay(tehranWallClock(candidate), wall))
                return candidate;
        }
    }
    return guess;
}
function startOfTehranWeek(date) {
    const dayStart = startOfTehranDay(date);
    const daysIntoWeek = jalaliWeekdayIndex(date);
    return new Date(dayStart.getTime() - daysIntoWeek * MILLESECONDS_PER_DAY);
}
function endOfTehranWeek(date) {
    return new Date(startOfTehranWeek(date).getTime() + MILLESECONDS_PER_WEEK);
}
function sameCivilDay(a, b) {
    return (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
}
function onTehranMidnight(instant) {
    const { hour, minute } = tehranTime(instant);
    return hour === 0 && minute === 0;
}
function tehranWallClock(date) {
    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: TEHRAN_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    return new Date(part(formatted, 'year'), part(formatted, 'month') - 1, part(formatted, 'day'), part(formatted, 'hour'), part(formatted, 'minute'), part(formatted, 'second'));
}
function tehranTime(date) {
    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: TEHRAN_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    return {
        hour: part(formatted, 'hour'),
        minute: part(formatted, 'minute'),
    };
}
function weekdayInTehran(date) {
    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: TEHRAN_TIME_ZONE,
        weekday: 'short',
    }).format(date);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const index = weekdays.indexOf(formatted);
    if (index < 0) {
        throw new RangeError(`Unexpected weekday label: ${formatted}`);
    }
    return index;
}
function part(parts, type) {
    const value = parts.find((item) => item.type === type)?.value ?? '0';
    return Number(value);
}
function pad2(value) {
    return value.toString().padStart(2, '0');
}
