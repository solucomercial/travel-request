"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobs = startJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const service_1 = require("../../modules/notificacoes/service");
const service_2 = require("../../modules/relatorios/service");
let started = false;
function startJobs() {
    if (started) {
        return;
    }
    started = true;
    node_cron_1.default.schedule('*/1 * * * *', async () => {
        await (0, service_1.processEmailOutboxBatch)(25);
    });
    node_cron_1.default.schedule('0 8 1 * *', async () => {
        await (0, service_2.sendMonthlyReportToApprovers)();
    });
}
