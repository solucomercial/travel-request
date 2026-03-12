"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecureToken = generateSecureToken;
exports.hashToken = hashToken;
exports.addMinutes = addMinutes;
exports.addDays = addDays;
const node_crypto_1 = require("node:crypto");
function generateSecureToken(size = 48) {
    return (0, node_crypto_1.randomBytes)(size).toString('hex');
}
function hashToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}
function addDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
