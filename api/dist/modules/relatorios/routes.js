"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relatoriosRoutes = relatoriosRoutes;
const roles_1 = require("../../common/roles");
const service_1 = require("./service");
async function relatoriosRoutes(app) {
    app.post('/reports/monthly/trigger', { preHandler: [(0, roles_1.requireRoles)(['ADMINISTRADOR'])] }, async () => {
        await (0, service_1.sendMonthlyReportToApprovers)();
        return { ok: true };
    });
}
