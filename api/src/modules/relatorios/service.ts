import { query } from '../../infra/db/pool'
import { queueEmail } from '../notificacoes/service'

export async function sendMonthlyReportToApprovers() {
  const [summary, approvers] = await Promise.all([
    query<{
      total_viagens: number
      total_gasto: number
      top_centro: string | null
      top_solicitante: string | null
    }>(
      `
        WITH periodo AS (
          SELECT NOW() - INTERVAL '30 days' AS inicio
        ),
        viagens AS (
          SELECT COUNT(*)::int AS total_viagens
          FROM solicitacoes s, periodo p
          WHERE s.created_at >= p.inicio
        ),
        gastos AS (
          SELECT COALESCE(SUM(c.valor), 0)::numeric(14,2) AS total_gasto
          FROM compras c, periodo p
          WHERE c.created_at >= p.inicio
        ),
        centro AS (
          SELECT cc.codigo
          FROM compras c
          INNER JOIN solicitacoes s ON s.id = c.solicitacao_id
          INNER JOIN centros_custo cc ON cc.id = s.centro_custo_id,
          periodo p
          WHERE c.created_at >= p.inicio
          GROUP BY cc.codigo
          ORDER BY SUM(c.valor) DESC
          LIMIT 1
        ),
        solicitante AS (
          SELECT u.nome
          FROM solicitacoes s
          INNER JOIN usuarios u ON u.id = s.solicitante_id,
          periodo p
          WHERE s.created_at >= p.inicio
          GROUP BY u.nome
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
        SELECT
          (SELECT total_viagens FROM viagens),
          (SELECT total_gasto FROM gastos),
          (SELECT codigo FROM centro) AS top_centro,
          (SELECT nome FROM solicitante) AS top_solicitante
      `
    ),
    query<{ email: string; nome: string }>(
      `SELECT email::text, nome FROM usuarios WHERE role = 'APROVADOR' AND ativo = TRUE`
    )
  ])

  const report = summary.rows[0]
  const summaryHtml = `
    <p><b>Total de viagens:</b> ${report?.total_viagens ?? 0}</p>
    <p><b>Total gasto:</b> R$ ${Number(report?.total_gasto ?? 0).toFixed(2)}</p>
    <p><b>Centro de custo com maior gasto:</b> ${report?.top_centro ?? 'N/A'}</p>
    <p><b>Solicitante com mais viagens:</b> ${report?.top_solicitante ?? 'N/A'}</p>
  `

  for (const approver of approvers.rows) {
    await queueEmail({
      tipo: 'RELATORIO_MENSAL',
      destinatario: approver.email,
      assunto: 'Resumo mensal de viagens (ultimos 30 dias)',
      payload: {
        nome: approver.nome,
        summaryHtml
      }
    })
  }
}
