"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.solicitacoesRoutes = solicitacoesRoutes;
const zod_1 = require("zod");
const http_error_1 = require("../../common/http-error");
const roles_1 = require("../../common/roles");
const pool_1 = require("../../infra/db/pool");
const service_1 = require("../auditoria/service");
const service_2 = require("../notificacoes/service");
const requestSchema = zod_1.z.object({
    centroCustoCodigo: zod_1.z.string().min(1),
    centroCustoDepartamento: zod_1.z.string().min(2),
    origem: zod_1.z.string().min(2),
    destino: zod_1.z.string().min(2),
    dataPartida: zod_1.z.coerce.date(),
    dataRetorno: zod_1.z.coerce.date(),
    precisaBagagem: zod_1.z.boolean().default(false),
    precisaHotel: zod_1.z.boolean().default(false),
    precisaCarro: zod_1.z.boolean().default(false),
    motivoViagem: zod_1.z.string().min(5),
    observacoes: zod_1.z.string().optional()
});
const rejectSchema = zod_1.z.object({
    justificativa: zod_1.z.string().min(5)
});
const purchaseSchema = zod_1.z.object({
    tipo: zod_1.z.enum(['PASSAGEM', 'HOTEL', 'CARRO']),
    codigoReserva: zod_1.z.string().min(3),
    valor: zod_1.z.number().nonnegative()
});
async function ensureCostCenter(codigo, departamento, ano) {
    const { rows: existing } = await (0, pool_1.query)(`SELECT id FROM centros_custo WHERE codigo = $1 AND ano_referencia = $2`, [codigo, ano]);
    if (existing[0]) {
        return existing[0].id;
    }
    const { rows } = await (0, pool_1.query)(`
      INSERT INTO centros_custo (codigo, departamento, ano_referencia, orcamento_anual, valor_utilizado)
      VALUES ($1, $2, $3, 0, 0)
      RETURNING id
    `, [codigo, departamento, ano]);
    return rows[0].id;
}
async function solicitacoesRoutes(app) {
    app.post('/requests', { preHandler: [(0, roles_1.requireRoles)(['SOLICITANTE'])] }, async (request) => {
        const body = requestSchema.parse(request.body);
        if (body.dataRetorno < body.dataPartida) {
            throw new http_error_1.HttpError(400, 'Data de retorno nao pode ser menor que data de partida');
        }
        const anoReferencia = body.dataPartida.getFullYear();
        const centroCustoId = await ensureCostCenter(body.centroCustoCodigo, body.centroCustoDepartamento, anoReferencia);
        const { rows } = await (0, pool_1.query)(`
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
      `, [
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
        ]);
        const solicitacaoId = rows[0].id;
        const approvers = await (0, pool_1.query)(`SELECT nome, email::text FROM usuarios WHERE role = 'APROVADOR' AND ativo = TRUE`);
        for (const approver of approvers.rows) {
            await (0, service_2.queueEmail)({
                tipo: 'SOLICITACAO_CRIADA',
                destinatario: approver.email,
                assunto: 'Nova solicitacao de viagem em analise',
                payload: {
                    nome: request.user.nome,
                    solicitacaoId
                }
            });
        }
        await (0, service_1.createAuditLog)({
            usuarioId: request.user.sub,
            acao: 'CREATE',
            entidade: 'solicitacoes',
            entidadeId: solicitacaoId,
            dadosNovos: body,
            request
        });
        return { id: solicitacaoId, status: 'EM_ANALISE' };
    });
    app.get('/requests', { preHandler: [(0, roles_1.requireRoles)(['SOLICITANTE', 'APROVADOR', 'COMPRADOR', 'ADMINISTRADOR'])] }, async (request) => {
        if (request.user.role === 'SOLICITANTE') {
            const { rows } = await (0, pool_1.query)(`
          SELECT s.*, c.codigo AS centro_custo_codigo
          FROM solicitacoes s
          INNER JOIN centros_custo c ON c.id = s.centro_custo_id
          WHERE s.solicitante_id = $1
          ORDER BY s.created_at DESC
        `, [request.user.sub]);
            return rows;
        }
        if (request.user.role === 'APROVADOR') {
            const { rows } = await (0, pool_1.query)(`
          SELECT s.*, c.codigo AS centro_custo_codigo, u.nome AS solicitante_nome
          FROM solicitacoes s
          INNER JOIN centros_custo c ON c.id = s.centro_custo_id
          INNER JOIN usuarios u ON u.id = s.solicitante_id
          WHERE s.status = 'EM_ANALISE' AND s.cancelado = FALSE
          ORDER BY s.created_at ASC
        `);
            return rows;
        }
        const { rows } = await (0, pool_1.query)(`
        SELECT s.*, c.codigo AS centro_custo_codigo, u.nome AS solicitante_nome
        FROM solicitacoes s
        INNER JOIN centros_custo c ON c.id = s.centro_custo_id
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        ORDER BY s.created_at DESC
      `);
        return rows;
    });
    app.post('/requests/:id/approve', { preHandler: [(0, roles_1.requireRoles)(['APROVADOR'])] }, async (request) => {
        const params = zod_1.z.object({ id: zod_1.z.uuid() }).parse(request.params);
        const { rows } = await (0, pool_1.query)(`
        SELECT s.id, s.solicitante_id, s.status, s.cancelado, u.nome AS solicitante_nome, u.email::text AS solicitante_email
        FROM solicitacoes s
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        WHERE s.id = $1
      `, [params.id]);
        const requestRow = rows[0];
        if (!requestRow) {
            throw new http_error_1.HttpError(404, 'Solicitacao nao encontrada');
        }
        if (requestRow.solicitante_id === request.user.sub) {
            throw new http_error_1.HttpError(403, 'Aprovador nao pode aprovar solicitacao propria');
        }
        if (requestRow.cancelado || requestRow.status !== 'EM_ANALISE') {
            throw new http_error_1.HttpError(400, 'Solicitacao nao esta em analise');
        }
        await (0, pool_1.query)(`
        UPDATE solicitacoes
        SET status = 'APROVADO', aprovado_por = $2, aprovado_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [params.id, request.user.sub]);
        await (0, service_2.queueEmail)({
            tipo: 'SOLICITACAO_APROVADA',
            destinatario: requestRow.solicitante_email,
            assunto: 'Solicitacao aprovada',
            payload: {
                nome: requestRow.solicitante_nome,
                solicitacaoId: requestRow.id
            }
        });
        await (0, service_1.createAuditLog)({
            usuarioId: request.user.sub,
            acao: 'APPROVE',
            entidade: 'solicitacoes',
            entidadeId: params.id,
            request
        });
        return { id: params.id, status: 'APROVADO' };
    });
    app.post('/requests/:id/reject', { preHandler: [(0, roles_1.requireRoles)(['APROVADOR'])] }, async (request) => {
        const params = zod_1.z.object({ id: zod_1.z.uuid() }).parse(request.params);
        const body = rejectSchema.parse(request.body);
        const { rows } = await (0, pool_1.query)(`
        SELECT s.id, s.solicitante_id, s.status, s.cancelado, u.nome AS solicitante_nome, u.email::text AS solicitante_email
        FROM solicitacoes s
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        WHERE s.id = $1
      `, [params.id]);
        const requestRow = rows[0];
        if (!requestRow) {
            throw new http_error_1.HttpError(404, 'Solicitacao nao encontrada');
        }
        if (requestRow.solicitante_id === request.user.sub) {
            throw new http_error_1.HttpError(403, 'Aprovador nao pode rejeitar solicitacao propria');
        }
        if (requestRow.cancelado || requestRow.status !== 'EM_ANALISE') {
            throw new http_error_1.HttpError(400, 'Solicitacao nao esta em analise');
        }
        await (0, pool_1.query)(`
        UPDATE solicitacoes
        SET status = 'REJEITADO', justificativa_rejeicao = $2, aprovado_por = $3, aprovado_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [params.id, body.justificativa, request.user.sub]);
        await (0, service_2.queueEmail)({
            tipo: 'SOLICITACAO_REJEITADA',
            destinatario: requestRow.solicitante_email,
            assunto: 'Solicitacao rejeitada',
            payload: {
                nome: requestRow.solicitante_nome,
                solicitacaoId: requestRow.id,
                justificativa: body.justificativa
            }
        });
        await (0, service_1.createAuditLog)({
            usuarioId: request.user.sub,
            acao: 'REJECT',
            entidade: 'solicitacoes',
            entidadeId: params.id,
            dadosNovos: body,
            request
        });
        return { id: params.id, status: 'REJEITADO' };
    });
    app.post('/requests/:id/cancel', { preHandler: [(0, roles_1.requireRoles)(['SOLICITANTE'])] }, async (request) => {
        const params = zod_1.z.object({ id: zod_1.z.uuid() }).parse(request.params);
        const { rows } = await (0, pool_1.query)(`SELECT id, solicitante_id, status, cancelado FROM solicitacoes WHERE id = $1`, [params.id]);
        const requestRow = rows[0];
        if (!requestRow) {
            throw new http_error_1.HttpError(404, 'Solicitacao nao encontrada');
        }
        if (requestRow.solicitante_id !== request.user.sub) {
            throw new http_error_1.HttpError(403, 'Voce nao pode cancelar esta solicitacao');
        }
        if (requestRow.cancelado || requestRow.status === 'COMPRADO') {
            throw new http_error_1.HttpError(400, 'Solicitacao nao pode ser cancelada');
        }
        await (0, pool_1.query)(`
        UPDATE solicitacoes
        SET cancelado = TRUE, cancelado_por = $2, cancelado_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [params.id, request.user.sub]);
        await (0, service_1.createAuditLog)({
            usuarioId: request.user.sub,
            acao: 'CANCEL',
            entidade: 'solicitacoes',
            entidadeId: params.id,
            request
        });
        return { id: params.id, cancelado: true };
    });
    app.post('/requests/:id/purchases', { preHandler: [(0, roles_1.requireRoles)(['COMPRADOR', 'ADMINISTRADOR'])] }, async (request) => {
        const params = zod_1.z.object({ id: zod_1.z.uuid() }).parse(request.params);
        const body = purchaseSchema.parse(request.body);
        const { rows } = await (0, pool_1.query)(`
        SELECT s.id, s.status, s.cancelado, s.centro_custo_id, u.nome AS solicitante_nome, u.email::text AS solicitante_email
        FROM solicitacoes s
        INNER JOIN usuarios u ON u.id = s.solicitante_id
        WHERE s.id = $1
      `, [params.id]);
        const requestRow = rows[0];
        if (!requestRow) {
            throw new http_error_1.HttpError(404, 'Solicitacao nao encontrada');
        }
        if (requestRow.cancelado || requestRow.status !== 'APROVADO') {
            throw new http_error_1.HttpError(400, 'Solicitacao precisa estar aprovada para registrar compra');
        }
        await (0, pool_1.withTransaction)(async (client) => {
            await client.query(`
          INSERT INTO compras (solicitacao_id, tipo, codigo_reserva, valor, criado_por)
          VALUES ($1, $2, $3, $4, $5)
        `, [params.id, body.tipo, body.codigoReserva, body.valor, request.user.sub]);
            await client.query(`
          UPDATE centros_custo
          SET valor_utilizado = valor_utilizado + $2, updated_at = NOW()
          WHERE id = $1
        `, [requestRow.centro_custo_id, body.valor]);
            await client.query(`
          UPDATE solicitacoes
          SET status = 'COMPRADO', updated_at = NOW()
          WHERE id = $1
        `, [params.id]);
            const centerResult = await client.query(`
          SELECT id, valor_utilizado, orcamento_anual
          FROM centros_custo
          WHERE id = $1
        `, [requestRow.centro_custo_id]);
            const center = centerResult.rows[0];
            if (center && center.orcamento_anual > 0) {
                const percentual = (center.valor_utilizado / center.orcamento_anual) * 100;
                if (percentual >= 80) {
                    await client.query(`
              INSERT INTO alertas_orcamento (centro_custo_id, percentual_utilizado, mensagem)
              VALUES ($1, $2, $3)
            `, [
                        center.id,
                        percentual,
                        percentual > 100
                            ? 'Centro de custo ultrapassou o orcamento anual.'
                            : 'Centro de custo proximo do limite anual.'
                    ]);
                }
            }
        });
        await (0, service_2.queueEmail)({
            tipo: 'COMPRA_REALIZADA',
            destinatario: requestRow.solicitante_email,
            assunto: 'Compra da viagem realizada',
            payload: {
                nome: requestRow.solicitante_nome,
                solicitacaoId: params.id
            }
        });
        await (0, service_1.createAuditLog)({
            usuarioId: request.user.sub,
            acao: 'PURCHASE',
            entidade: 'compras',
            entidadeId: params.id,
            dadosNovos: body,
            request
        });
        return { id: params.id, status: 'COMPRADO' };
    });
}
