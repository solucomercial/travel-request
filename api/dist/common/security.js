"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCorporateEmail = isCorporateEmail;
exports.validateStrongPassword = validateStrongPassword;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;
const commonPasswords = new Set([
    'Password@123',
    '1234567890Aa!',
    'Qwerty@123456',
    'Admin@123456'
]);
function isCorporateEmail(email, corporateDomain) {
    const normalized = email.toLowerCase().trim();
    return normalized.endsWith(`@${corporateDomain}`);
}
function validateStrongPassword(password) {
    return PASSWORD_REGEX.test(password) && !commonPasswords.has(password);
}
