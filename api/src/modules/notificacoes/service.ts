import nodemailer from 'nodemailer'
import { env } from '../../config/env'
import { query } from '../../infra/db/pool'
import {
  approvalRequestTemplate,
  approvedTemplate,
  monthlyReportTemplate,
  passwordResetTemplate,
  purchasedTemplate,
  rejectedTemplate
} from '../../infra/email/templates'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
})

type NotificationType =
  | 'SOLICITACAO_CRIADA'
  | 'SOLICITACAO_APROVADA'
  | 'SOLICITACAO_REJEITADA'
  | 'COMPRA_REALIZADA'
  | 'RECUPERACAO_SENHA'
  | 'RELATORIO_MENSAL'

interface QueueEmailInput {
  tipo: NotificationType
  destinatario: string
  assunto: string
  payload: Record<string, unknown>
}

export async function queueEmail(input: QueueEmailInput) {
  await query(
    `
      INSERT INTO outbox_emails (tipo, destinatario, assunto, payload)
      VALUES ($1, $2, $3, $4::jsonb)
    `,
    [input.tipo, input.destinatario, input.assunto, JSON.stringify(input.payload)]
  )
}

function renderTemplate(tipo: NotificationType, payload: Record<string, unknown>) {
  switch (tipo) {
    case 'SOLICITACAO_CRIADA':
      return approvalRequestTemplate(payload as { nome: string; solicitacaoId: string })
    case 'SOLICITACAO_APROVADA':
      return approvedTemplate(payload as { nome: string; solicitacaoId: string })
    case 'SOLICITACAO_REJEITADA':
      return rejectedTemplate(payload as { nome: string; solicitacaoId: string; justificativa: string })
    case 'COMPRA_REALIZADA':
      return purchasedTemplate(payload as { nome: string; solicitacaoId: string })
    case 'RELATORIO_MENSAL':
      return monthlyReportTemplate(String(payload.summaryHtml ?? 'Sem dados no periodo'))
    case 'RECUPERACAO_SENHA':
      return passwordResetTemplate(payload as { nome: string; url: string })
    default:
      return '<p>Notificacao</p>'
  }
}

export async function processEmailOutboxBatch(limit = 20) {
  const { rows } = await query<{
    id: string
    tipo: NotificationType
    destinatario: string
    assunto: string
    payload: Record<string, unknown>
    tentativas: number
  }>(
    `
      SELECT id, tipo, destinatario, assunto, payload, tentativas
      FROM outbox_emails
      WHERE status = 'PENDENTE' AND proxima_tentativa_em <= NOW()
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [limit]
  )

  for (const item of rows) {
    try {
      const html = renderTemplate(item.tipo, item.payload)

      await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: item.destinatario,
        subject: item.assunto,
        html
      })

      await query(
        `
          UPDATE outbox_emails
          SET status = 'ENVIADO', enviado_em = NOW(), tentativas = tentativas + 1, erro_ultimo_envio = NULL
          WHERE id = $1
        `,
        [item.id]
      )
    } catch (error) {
      const maxReached = item.tentativas + 1 >= 5
      await query(
        `
          UPDATE outbox_emails
          SET
            status = $2,
            tentativas = tentativas + 1,
            erro_ultimo_envio = $3,
            proxima_tentativa_em = NOW() + INTERVAL '5 minutes'
          WHERE id = $1
        `,
        [item.id, maxReached ? 'FALHA_FINAL' : 'PENDENTE', String(error)]
      )
    }
  }
}
