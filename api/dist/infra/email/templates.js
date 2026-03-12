"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEmailTemplate = buildEmailTemplate;
exports.approvalRequestTemplate = approvalRequestTemplate;
exports.approvedTemplate = approvedTemplate;
exports.rejectedTemplate = rejectedTemplate;
exports.purchasedTemplate = purchasedTemplate;
exports.monthlyReportTemplate = monthlyReportTemplate;
exports.passwordResetTemplate = passwordResetTemplate;
function buildEmailTemplate(title, body) {
    return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;color:#1e3a8a">${title}</h2>
      <div>${body}</div>
      <p style="margin-top:20px;color:#6b7280">Sistema de Viagens Corporativas</p>
    </div>
  `;
}
function approvalRequestTemplate(payload) {
    return buildEmailTemplate('Nova solicitacao em analise', `<p>Uma nova solicitacao de viagem foi criada por ${payload.nome}.</p><p>ID: ${payload.solicitacaoId}</p>`);
}
function approvedTemplate(payload) {
    return buildEmailTemplate('Solicitacao aprovada', `<p>Ola, ${payload.nome}.</p><p>Sua solicitacao ${payload.solicitacaoId} foi aprovada.</p>`);
}
function rejectedTemplate(payload) {
    return buildEmailTemplate('Solicitacao rejeitada', `<p>Ola, ${payload.nome}.</p><p>Sua solicitacao ${payload.solicitacaoId} foi rejeitada.</p><p><b>Justificativa:</b> ${payload.justificativa}</p>`);
}
function purchasedTemplate(payload) {
    return buildEmailTemplate('Compra realizada', `<p>Ola, ${payload.nome}.</p><p>A compra da solicitacao ${payload.solicitacaoId} foi concluida.</p>`);
}
function monthlyReportTemplate(summaryHtml) {
    return buildEmailTemplate('Resumo de viagens dos ultimos 30 dias', summaryHtml);
}
function passwordResetTemplate(payload) {
    return buildEmailTemplate('Recuperacao de senha', `<p>Ola, ${payload.nome}.</p><p>Clique no link para redefinir sua senha:</p><p><a href="${payload.url}">${payload.url}</a></p><p>Este link expira em 30 minutos.</p>`);
}
