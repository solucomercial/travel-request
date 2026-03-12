import { requireRoles } from '../../common/roles'
import { query } from '../../infra/db/pool'

export async function dashboardRoutes(app: any) {
  app.get('/dashboard/summary', { preHandler: [requireRoles(['APROVADOR', 'COMPRADOR', 'ADMINISTRADOR'])] }, async () => {
    const [costCenter, department, period, ranking, alerts] = await Promise.all([
      query<{
        codigo: string
        departamento: string
        orcamento_anual: number
        valor_utilizado: number
      }>(
        `
          SELECT codigo, departamento, orcamento_anual, valor_utilizado
          FROM centros_custo
          ORDER BY valor_utilizado DESC
        `
      ),
      query<{ departamento: string; total: number }>(
        `
          SELECT u.departamento, COALESCE(SUM(c.valor), 0) AS total
          FROM compras c
          INNER JOIN solicitacoes s ON s.id = c.solicitacao_id
          INNER JOIN usuarios u ON u.id = s.solicitante_id
          GROUP BY u.departamento
          ORDER BY total DESC
        `
      ),
      query<{ periodo: string; total_viagens: number }>(
        `
          SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS periodo, COUNT(*)::int AS total_viagens
          FROM solicitacoes
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY DATE_TRUNC('month', created_at) DESC
          LIMIT 12
        `
      ),
      query<{ solicitante: string; total: number }>(
        `
          SELECT u.nome AS solicitante, COUNT(*)::int AS total
          FROM solicitacoes s
          INNER JOIN usuarios u ON u.id = s.solicitante_id
          GROUP BY u.nome
          ORDER BY total DESC
          LIMIT 10
        `
      ),
      query<{
        codigo: string
        departamento: string
        orcamento_anual: number
        valor_utilizado: number
        percentual: number
      }>(
        `
          SELECT
            codigo,
            departamento,
            orcamento_anual,
            valor_utilizado,
            CASE
              WHEN orcamento_anual = 0 THEN 0
              ELSE ROUND((valor_utilizado / orcamento_anual) * 100, 2)
            END AS percentual
          FROM centros_custo
          WHERE orcamento_anual > 0
            AND (valor_utilizado / orcamento_anual) >= 0.8
          ORDER BY percentual DESC
        `
      )
    ])

    return {
      gastosPorCentroCusto: costCenter.rows,
      gastosPorDepartamento: department.rows,
      viagensPorPeriodo: period.rows,
      rankingSolicitantes: ranking.rows,
      alertaCentrosProximosLimite: alerts.rows
    }
  })
}
