"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JalaliDateService = void 0;
const common_1 = require("@nestjs/common");
const date_fns_jalali_1 = require("date-fns-jalali");
const jalali_date_util_1 = require("../../utils/jalali-date.util");
const persian_number_util_1 = require("../../utils/persian-number.util");
const PERSIAN_DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const PERSIAN_MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];
const JALALI_DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
let JalaliDateService = class JalaliDateService {
    toJalali(gregorianDate) {
        const parts = (0, jalali_date_util_1.toJalali)(gregorianDate);
        return (0, persian_number_util_1.toPersianDigits)(`${parts.year}/${parts.month}/${parts.day}`);
    }
    toGregorian(jalaliDate) {
        const normalized = (0, persian_number_util_1.toLatinDigits)(jalaliDate).trim();
        const match = JALALI_DATE.exec(normalized);
        if (!match)
            throw new RangeError('Invalid Jalali date');
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const parsed = (0, date_fns_jalali_1.parse)(normalized, 'yyyy/M/d', new Date(2000, 0, 1));
        if (Number.isNaN(parsed.getTime()) || (0, date_fns_jalali_1.getYear)(parsed) !== year || (0, date_fns_jalali_1.getMonth)(parsed) !== month - 1 || (0, date_fns_jalali_1.getDate)(parsed) !== day) {
            throw new RangeError('Invalid Jalali date');
        }
        return (0, date_fns_jalali_1.newDate)(year, month - 1, day);
    }
    getPersianDayName(date) {
        return PERSIAN_DAY_NAMES[(0, jalali_date_util_1.jalaliWeekdayIndex)(date)];
    }
    isFriday(date) {
        return (0, jalali_date_util_1.isFriday)(date);
    }
    getWeekStart(date) {
        const parts = (0, jalali_date_util_1.toJalali)(date);
        const midnight = (0, date_fns_jalali_1.newDate)(parts.year, parts.month - 1, parts.day);
        midnight.setUTCDate(midnight.getUTCDate() - (0, jalali_date_util_1.jalaliWeekdayIndex)(date));
        return midnight;
    }
    formatPersianDate(date) {
        const parts = (0, jalali_date_util_1.toJalali)(date);
        return `${this.getPersianDayName(date)} ${(0, persian_number_util_1.toPersianDigits)(parts.day)} ${this.getPersianMonthName(parts.month)} ${(0, persian_number_util_1.toPersianDigits)(parts.year)}`;
    }
    getPersianMonthName(month) {
        const name = PERSIAN_MONTH_NAMES[month - 1];
        if (!name)
            throw new RangeError('Invalid Jalali month');
        return name;
    }
    toPersianNumerals(input) {
        return (0, persian_number_util_1.toPersianDigits)(input);
    }
    normalizePersianNumerals(input) {
        return (0, persian_number_util_1.toLatinDigits)(input);
    }
    getCurrentJalali(now = new Date()) {
        return this.toJalali(now);
    }
    getCurrentJalaliTime(now = new Date()) {
        return (0, jalali_date_util_1.formatJalaliTime)(now);
    }
    isHoliday(date, extraHolidays = new Set()) {
        return this.isFriday(date) || extraHolidays.has(this.toJalali(date));
    }
};
exports.JalaliDateService = JalaliDateService;
exports.JalaliDateService = JalaliDateService = __decorate([
    (0, common_1.Injectable)()
], JalaliDateService);
