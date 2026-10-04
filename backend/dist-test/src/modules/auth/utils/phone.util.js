"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.validatePhone = validatePhone;
exports.isIranianMobile = isIranianMobile;
exports.getOperator = getOperator;
const persian_number_util_1 = require("../../../utils/persian-number.util");
const IRANIAN_MOBILE = /^09[0-9]{9}$/;
function normalizePhone(input) {
    if (typeof input !== 'string')
        return '';
    let value = (0, persian_number_util_1.toLatinDigits)(input).trim();
    value = value.replace(/[\s\-().]/g, '');
    if (value.startsWith('+98'))
        value = `0${value.slice(3)}`;
    else if (value.startsWith('0098'))
        value = `0${value.slice(4)}`;
    else if (value.startsWith('98') && value.length === 12)
        value = `0${value.slice(2)}`;
    else if (value.startsWith('9') && value.length === 10)
        value = `0${value}`;
    return value;
}
function validatePhone(phone) {
    return IRANIAN_MOBILE.test(phone);
}
function isIranianMobile(input) {
    return validatePhone(normalizePhone(input));
}
function getOperator(phone) {
    if (!validatePhone(phone))
        return null;
    const prefix = Number(phone.slice(0, 4));
    if ((prefix >= 910 && prefix <= 919) || (prefix >= 990 && prefix <= 999))
        return 'همراه اول';
    if ((prefix >= 901 && prefix <= 905) || (prefix >= 930 && prefix <= 939))
        return 'ایرانسل';
    if (prefix >= 920 && prefix <= 922)
        return 'رایتل';
    return null;
}
