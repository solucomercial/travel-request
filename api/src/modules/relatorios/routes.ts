import { requireRoles } from '../../common/roles'
import { sendMonthlyReportToApprovers } from './service'

export async function relatoriosRoutes(app: any) {
  app.post('/reports/monthly/trigger', { preHandler: [requireRoles(['ADMINISTRADOR'])] }, async () => {
    await sendMonthlyReportToApprovers()
    return { ok: true }
  })
}
