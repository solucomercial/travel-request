import cron from 'node-cron'
import { processEmailOutboxBatch } from '../../modules/notificacoes/service'
import { sendMonthlyReportToApprovers } from '../../modules/relatorios/service'

let started = false

export function startJobs() {
  if (started) {
    return
  }

  started = true

  cron.schedule('*/1 * * * *', async () => {
    await processEmailOutboxBatch(25)
  })

  cron.schedule('0 8 1 * *', async () => {
    await sendMonthlyReportToApprovers()
  })
}
