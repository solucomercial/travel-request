interface BasePayload {
  nome: string
  solicitacaoId?: string
}

export function buildEmailTemplate(title: string, body: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;color:#1e3a8a">${title}</h2>
      <div>${body}</div>
      <p style="margin-top:20px;color:#6b7280">Sistema de Viagens Corporativas</p>
    </div>
  `
}

export function approvalRequestTemplate(payload: BasePayload) {
  return buildEmailTemplate(
    'Nova solicitacao em analise',
    `<p>Uma nova solicitacao de viagem foi criada por ${payload.nome}.</p><p>ID: ${payload.solicitacaoId}</p>`
  )
}

export function approvedTemplate(payload: BasePayload) {
  return buildEmailTemplate(
    'Solicitacao aprovada',
    `<p>Ola, ${payload.nome}.</p><p>Sua solicitacao ${payload.solicitacaoId} foi aprovada.</p>`
  )
}

export function rejectedTemplate(payload: BasePayload & { justificativa: string }) {
  return buildEmailTemplate(
    'Solicitacao rejeitada',
    `<p>Ola, ${payload.nome}.</p><p>Sua solicitacao ${payload.solicitacaoId} foi rejeitada.</p><p><b>Justificativa:</b> ${payload.justificativa}</p>`
  )
}

export function purchasedTemplate(payload: BasePayload) {
  return buildEmailTemplate(
    'Compra realizada',
    `<p>Ola, ${payload.nome}.</p><p>A compra da solicitacao ${payload.solicitacaoId} foi concluida.</p>`
  )
}

export function monthlyReportTemplate(summaryHtml: string) {
  return buildEmailTemplate('Resumo de viagens dos ultimos 30 dias', summaryHtml)
}

export function passwordResetTemplate(payload: { nome: string; url: string }) {
  return buildEmailTemplate(
    'Recuperacao de senha',
    `<p>Ola, ${payload.nome}.</p><p>Clique no link para redefinir sua senha:</p><p><a href="${payload.url}">${payload.url}</a></p><p>Este link expira em 30 minutos.</p>`
  )
}
