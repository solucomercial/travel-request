"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueEmail = queueEmail;
exports.processEmailOutboxBatch = processEmailOutboxBatch;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../../config/env");
const pool_1 = require("../../infra/db/pool");
const templates_1 = require("../../infra/email/templates");
const transporter = nodemailer_1.default.createTransport({
    host: env_1.env.SMTP_HOST,
    port: env_1.env.SMTP_PORT,
    secure: false,
    auth: env_1.env.SMTP_USER ? { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS } : undefined
});
async function queueEmail(input) {
    await (0, pool_1.query)(`
      INSERT INTO outbox_emails (tipo, destinatario, assunto, payload)
      VALUES ($1, $2, $3, $4::jsonb)
    `, [input.tipo, input.destinatario, input.assunto, JSON.stringify(input.payload)]);
}
function renderTemplate(tipo, payload) {
    switch (tipo) {
        case 'SOLICITACAO_CRIADA':
            return (0, templates_1.approvalRequestTemplate)(payload);
        case 'SOLICITACAO_APROVADA':
            return (0, templates_1.approvedTemplate)(payload);
        case 'SOLICITACAO_REJEITADA':
            return (0, templates_1.rejectedTemplate)(payload);
        case 'COMPRA_REALIZADA':
            return (0, templates_1.purchasedTemplate)(payload);
        case 'RELATORIO_MENSAL':
            return (0, templates_1.monthlyReportTemplate)(String(payload.summaryHtml ?? 'Sem dados no periodo'));
        case 'RECUPERACAO_SENHA':
            return (0, templates_1.passwordResetTemplate)(payload);
        default:
            return '<p>Notificacao</p>';
    }
}
async function processEmailOutboxBatch(limit = 20) {
    const { rows } = await (0, pool_1.query)(`
      SELECT id, tipo, destinatario, assunto, payload, tentativas
      FROM outbox_emails
      WHERE status = 'PENDENTE' AND proxima_tentativa_em <= NOW()
      ORDER BY created_at ASC
      LIMIT $1
    `, [limit]);
    for (const item of rows) {
        try {
            const html = renderTemplate(item.tipo, item.payload);
            await transporter.sendMail({
                from: env_1.env.EMAIL_FROM,
                to: item.destinatario,
                subject: item.assunto,
                html
            });
            await (0, pool_1.query)(`
          UPDATE outbox_emails
          SET status = 'ENVIADO', enviado_em = NOW(), tentativas = tentativas + 1, erro_ultimo_envio = NULL
          WHERE id = $1
        `, [item.id]);
        }
        catch (error) {
            const maxReached = item.tentativas + 1 >= 5;
            await (0, pool_1.query)(`
          UPDATE outbox_emails
          SET
            status = $2,
            tentativas = tentativas + 1,
            erro_ultimo_envio = $3,
            proxima_tentativa_em = NOW() + INTERVAL '5 minutes'
          WHERE id = $1
        `, [item.id, maxReached ? 'FALHA_FINAL' : 'PENDENTE', String(error)]);
        }
    }
}
