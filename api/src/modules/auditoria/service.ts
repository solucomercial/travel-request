import { query } from '../../infra/db/pool'

type Action =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAIL'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'APPROVE'
  | 'REJECT'
  | 'PURCHASE'
  | 'CANCEL'

interface AuditInput {
  usuarioId?: string | null
  acao: Action
  entidade: string
  entidadeId?: string | null
  dadosAnteriores?: unknown
  dadosNovos?: unknown
  request?: any
}

export async function createAuditLog(input: AuditInput) {
  const ip = input.request?.ip ?? null
  const userAgent = input.request?.headers['user-agent'] ?? null
  const requestId = input.request?.id ?? null

  await query(
    `
      INSERT INTO logs_auditoria
      (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, ip, user_agent, request_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      input.usuarioId ?? null,
      input.acao,
      input.entidade,
      input.entidadeId ?? null,
      input.dadosAnteriores ? JSON.stringify(input.dadosAnteriores) : null,
      input.dadosNovos ? JSON.stringify(input.dadosNovos) : null,
      ip,
      userAgent,
      requestId
    ]
  )
}
