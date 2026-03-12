import { z } from 'zod'
import { HttpError } from '../../common/http-error'
import { requireRoles } from '../../common/roles'
import { query, withTransaction } from '../../infra/db/pool'
import { createAuditLog } from '../auditoria/service'
import { queueEmail } from '../notificacoes/service'

const requestSchema = z.object({
  centroCustoCodigo: z.string().min(1),
  centroCustoDepartamento: z.string().min(2),
  origem: z.string().min(2),
  destino: z.string().min(2),
  dataPartida: z.coerce.date(),
  dataRetorno: z.coerce.date(),
  precisaBagagem: z.boolean().default(false),
  precisaHotel: z.boolean().default(false),
  precisaCarro: z.boolean().default(false),
  motivoViagem: z.string().min(5),
  observacoes: z.string().optional()
})

const rejectSchema = z.object({
  justificativa: z.string().min(5)
})

const purchaseSchema = z.object({
  tipo: z.enum(['PASSAGEM', 'HOTEL', 'CARRO']),
  codigoReserva: z.string().min(3),
  valor: z.number().nonnegative()
})

async function ensureCostCenter(codigo: string, departamento: string, ano: number) {
  const { rows: existing } = await query<{ id: string }>(
    `SELECT id FROM centros_custo WHERE codigo = $1 AND ano_referencia = $2`,
    [codigo, ano]
  )

  if (existing[0]) {
    return existing[0].id
  }

  const { rows } = await query<{ id: string }>(
    `
      INSERT INTO centros_custo (codigo, departamento, ano_referencia, orcamento_anual, valor_utilizado)
      VALUES ($1, $2, $3, 0, 0)
      RETURNING id
    `,
    [codigo, departamento, ano]
  )

  return rows[0].id
}

export async function solicitacoesRoutes(app: any) {
  app.post('/requests', { preHandler: [requireRoles(['SOLICITANTE'])] }, async (request: any) => {
    const body = requestSchema.parse(request.body)

    if (body.dataRetorno < body.dataPartida) {
      throw new HttpError(400, 'Data de retorno nao pode ser menor que data de partida')
    }

    const anoReferencia = body.dataPartida.getFullYear()
    const centroCustoId = await ensureCostCenter(
      body.centroCustoCodigo,
      body.centroCustoDepartamento,
      anoReferencia
    )

    const { rows } = await query<{ id: string }>(
      `
        INSERT INTO solicitacoes
        (
          solicitante_id,
          centro_custo_id,
          origem,
          destino,
          data_partida,
          data_retorno,
          precisa_bagagem,
          precisa_hotel,
          precisa_carro,
          motivo_viagem,
          observacoes,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EM_ANALISE')
        RETURNING id
      `,
      [
        request.user.sub,
        centroCustoId,
        body.origem,
        body.destino,
        body.dataPartida,
        body.dataRetorno,
        body.precisaBagagem,
        body.precisaHotel,
        body.precisaCarro,
        body.motivoViagem,
        body.observacoes ?? null
      ]
    )

    const solicitacaoId = rows[0].id

    const approvers = await query<{ nome: string; email: string }>(
      `SELECT nome, email::text FROM usuarios WHERE role = 'APROVADOR' AND ativo = TRUE`
    )

    for (const approver of approvers.rows) {
      await queueEmail({
        tipo: 'SOLICITACAO_CRIADA',
        destinatario: approver.email,
        assunto: 'Nova solicitacao de viagem em analise',
        payload: {
          nome: request.user.nome,
          solicitacaoId
        }
      })
    }

    await createAuditLog({
      usuarioId: request.user.sub,
      acao: 'CREATE',
      entidade: 'solicitacoes',
      entidadeId: solicitacaoId,
      dadosNovos: body,
      request
    })

    return { id: solicitacaoId, status: 'EM_ANALISE' }
  })

  app.get('/requests', { preHandler: [requireRoles(['SOLICITANTE', 'APROVADOR', 'COMPRADOR', 'ADMINISTRADOR'])] }, async (request: any) => {
    if (request.user.role === 'SOLICITANTE') {
      const { rows } = await query(
        `
          SELECT s.*, c.codigo AS centro_custo_codigo
          FROM solicitacoes s
          INNER JOIN centros_custo c ON c.id = s.centro_custo_id
          WHERE s.solicitante_id = $1
          ORDER BY s.created_at DESC
        `,
        [request.user.sub]
      )
      return rows
    }

    if (request.user.role === 'APROVADOR') {
      const { rows } = await query(
        `
          SELECT s.*, c.codigo AS centro_custo_codigo, u.nome AS solicitante_nome
          FROM solicitacoes s
          INNER JOIN centros_custo c ON c.id = s.centro_custo_id
          INNER JOIN usuarios u ON u.id = s.solicitante_id
          WHERE s.status = 'EM_ANALISE' AND s.cancelado = FALSE
          ORDER BY s.created_at ASC
        `
      )
      return rows
    }

    const { rows } = await query(
      `
        SELECT s.*, c.codigo AS centro_custo_codigo, u.nome AS solicitante_nome
        FROM solicitacoes s
        INNER JOIN centros_custo c ON c.id = s.centro_custo_id
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        ORDER BY s.created_at DESC
      `
    )

    return rows
  })

  app.post('/requests/:id/approve', { preHandler: [requireRoles(['APROVADOR'])] }, async (request: any) => {
    const params = z.object({ id: z.uuid() }).parse(request.params)

    const { rows } = await query<{
      id: string
      solicitante_id: string
      status: 'EM_ANALISE' | 'APROVADO' | 'REJEITADO' | 'COMPRADO'
      cancelado: boolean
      solicitante_nome: string
      solicitante_email: string
    }>(
      `
        SELECT s.id, s.solicitante_id, s.status, s.cancelado, u.nome AS solicitante_nome, u.email::text AS solicitante_email
        FROM solicitacoes s
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        WHERE s.id = $1
      `,
      [params.id]
    )

    const requestRow = rows[0]
    if (!requestRow) {
      throw new HttpError(404, 'Solicitacao nao encontrada')
    }

    if (requestRow.solicitante_id === request.user.sub) {
      throw new HttpError(403, 'Aprovador nao pode aprovar solicitacao propria')
    }

    if (requestRow.cancelado || requestRow.status !== 'EM_ANALISE') {
      throw new HttpError(400, 'Solicitacao nao esta em analise')
    }

    await query(
      `
        UPDATE solicitacoes
        SET status = 'APROVADO', aprovado_por = $2, aprovado_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [params.id, request.user.sub]
    )

    await queueEmail({
      tipo: 'SOLICITACAO_APROVADA',
      destinatario: requestRow.solicitante_email,
      assunto: 'Solicitacao aprovada',
      payload: {
        nome: requestRow.solicitante_nome,
        solicitacaoId: requestRow.id
      }
    })

    await createAuditLog({
      usuarioId: request.user.sub,
      acao: 'APPROVE',
      entidade: 'solicitacoes',
      entidadeId: params.id,
      request
    })

    return { id: params.id, status: 'APROVADO' }
  })

  app.post('/requests/:id/reject', { preHandler: [requireRoles(['APROVADOR'])] }, async (request: any) => {
    const params = z.object({ id: z.uuid() }).parse(request.params)
    const body = rejectSchema.parse(request.body)

    const { rows } = await query<{
      id: string
      solicitante_id: string
      status: 'EM_ANALISE' | 'APROVADO' | 'REJEITADO' | 'COMPRADO'
      cancelado: boolean
      solicitante_nome: string
      solicitante_email: string
    }>(
      `
        SELECT s.id, s.solicitante_id, s.status, s.cancelado, u.nome AS solicitante_nome, u.email::text AS solicitante_email
        FROM solicitacoes s
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        WHERE s.id = $1
      `,
      [params.id]
    )

    const requestRow = rows[0]
    if (!requestRow) {
      throw new HttpError(404, 'Solicitacao nao encontrada')
    }

    if (requestRow.solicitante_id === request.user.sub) {
      throw new HttpError(403, 'Aprovador nao pode rejeitar solicitacao propria')
    }

    if (requestRow.cancelado || requestRow.status !== 'EM_ANALISE') {
      throw new HttpError(400, 'Solicitacao nao esta em analise')
    }

    await query(
      `
        UPDATE solicitacoes
        SET status = 'REJEITADO', justificativa_rejeicao = $2, aprovado_por = $3, aprovado_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [params.id, body.justificativa, request.user.sub]
    )

    await queueEmail({
      tipo: 'SOLICITACAO_REJEITADA',
      destinatario: requestRow.solicitante_email,
      assunto: 'Solicitacao rejeitada',
      payload: {
        nome: requestRow.solicitante_nome,
        solicitacaoId: requestRow.id,
        justificativa: body.justificativa
      }
    })

    await createAuditLog({
      usuarioId: request.user.sub,
      acao: 'REJECT',
      entidade: 'solicitacoes',
      entidadeId: params.id,
      dadosNovos: body,
      request
    })

    return { id: params.id, status: 'REJEITADO' }
  })

  app.post('/requests/:id/cancel', { preHandler: [requireRoles(['SOLICITANTE'])] }, async (request: any) => {
    const params = z.object({ id: z.uuid() }).parse(request.params)

    const { rows } = await query<{ id: string; solicitante_id: string; status: string; cancelado: boolean }>(
      `SELECT id, solicitante_id, status, cancelado FROM solicitacoes WHERE id = $1`,
      [params.id]
    )

    const requestRow = rows[0]
    if (!requestRow) {
      throw new HttpError(404, 'Solicitacao nao encontrada')
    }

    if (requestRow.solicitante_id !== request.user.sub) {
      throw new HttpError(403, 'Voce nao pode cancelar esta solicitacao')
    }

    if (requestRow.cancelado || requestRow.status === 'COMPRADO') {
      throw new HttpError(400, 'Solicitacao nao pode ser cancelada')
    }

    await query(
      `
        UPDATE solicitacoes
        SET cancelado = TRUE, cancelado_por = $2, cancelado_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [params.id, request.user.sub]
    )

    await createAuditLog({
      usuarioId: request.user.sub,
      acao: 'CANCEL',
      entidade: 'solicitacoes',
      entidadeId: params.id,
      request
    })

    return { id: params.id, cancelado: true }
  })

  app.post('/requests/:id/purchases', { preHandler: [requireRoles(['COMPRADOR', 'ADMINISTRADOR'])] }, async (request: any) => {
    const params = z.object({ id: z.uuid() }).parse(request.params)
    const body = purchaseSchema.parse(request.body)

    const { rows } = await query<{
      id: string
      status: 'EM_ANALISE' | 'APROVADO' | 'REJEITADO' | 'COMPRADO'
      cancelado: boolean
      centro_custo_id: string
      solicitante_nome: string
      solicitante_email: string
    }>(
      `
        SELECT s.id, s.status, s.cancelado, s.centro_custo_id, u.nome AS solicitante_nome, u.email::text AS solicitante_email
        FROM solicitacoes s
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        WHERE s.id = $1
      `,
      [params.id]
    )

    const requestRow = rows[0]
    if (!requestRow) {
      throw new HttpError(404, 'Solicitacao nao encontrada')
    }

    if (requestRow.cancelado || requestRow.status !== 'APROVADO') {
      throw new HttpError(400, 'Solicitacao precisa estar aprovada para registrar compra')
    }

    await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO compras (solicitacao_id, tipo, codigo_reserva, valor, criado_por)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [params.id, body.tipo, body.codigoReserva, body.valor, request.user.sub]
      )

      await client.query(
        `
          UPDATE centros_custo
          SET valor_utilizado = valor_utilizado + $2, updated_at = NOW()
          WHERE id = $1
        `,
        [requestRow.centro_custo_id, body.valor]
      )

      await client.query(
        `
          UPDATE solicitacoes
          SET status = 'COMPRADO', updated_at = NOW()
          WHERE id = $1
        `,
        [params.id]
      )

      const centerResult = await client.query<{
        id: string
        valor_utilizado: number
        orcamento_anual: number
      }>(
        `
          SELECT id, valor_utilizado, orcamento_anual
          FROM centros_custo
          WHERE id = $1
        `,
        [requestRow.centro_custo_id]
      )

      const center = centerResult.rows[0]
      if (center && center.orcamento_anual > 0) {
        const percentual = (center.valor_utilizado / center.orcamento_anual) * 100
        if (percentual >= 80) {
          await client.query(
            `
              INSERT INTO alertas_orcamento (centro_custo_id, percentual_utilizado, mensagem)
              VALUES ($1, $2, $3)
            `,
            [
              center.id,
              percentual,
              percentual > 100
                ? 'Centro de custo ultrapassou o orcamento anual.'
                : 'Centro de custo proximo do limite anual.'
            ]
          )
        }
      }
    })

    await queueEmail({
      tipo: 'COMPRA_REALIZADA',
      destinatario: requestRow.solicitante_email,
      assunto: 'Compra da viagem realizada',
      payload: {
        nome: requestRow.solicitante_nome,
        solicitacaoId: params.id
      }
    })

    await createAuditLog({
      usuarioId: request.user.sub,
      acao: 'PURCHASE',
      entidade: 'compras',
      entidadeId: params.id,
      dadosNovos: body,
      request
    })

    return { id: params.id, status: 'COMPRADO' }
  })
}
