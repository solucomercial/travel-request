'use client'

import { ProtectedPage } from '@/components/layout/protected-page'
import { apiRequest } from '@/lib/api'
import { useEffect, useState } from 'react'

type DashboardResponse = {
  gastosPorCentroCusto: Array<{ codigo: string; departamento: string; orcamento_anual: number; valor_utilizado: number }>
  gastosPorDepartamento: Array<{ departamento: string; total: number }>
  viagensPorPeriodo: Array<{ periodo: string; total_viagens: number }>
  rankingSolicitantes: Array<{ solicitante: string; total: number }>
  alertaCentrosProximosLimite: Array<{ codigo: string; percentual: number }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<DashboardResponse>('/dashboard/summary')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard'))
  }, [])

  return (
    <ProtectedPage>
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      {!data && !error && <p className="text-sm text-slate-500">Carregando indicadores...</p>}

      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-base font-black">Gastos por centro de custo</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {data.gastosPorCentroCusto.slice(0, 8).map((item) => (
                <li key={`${item.codigo}-${item.departamento}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{item.codigo} - {item.departamento}</span>
                  <strong>R$ {Number(item.valor_utilizado).toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-base font-black">Gastos por departamento</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {data.gastosPorDepartamento.map((item) => (
                <li key={item.departamento} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{item.departamento}</span>
                  <strong>R$ {Number(item.total).toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-base font-black">Viagens por periodo</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {data.viagensPorPeriodo.map((item) => (
                <li key={item.periodo} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{item.periodo}</span>
                  <strong>{item.total_viagens}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-base font-black">Ranking de solicitantes</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {data.rankingSolicitantes.map((item) => (
                <li key={item.solicitante} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{item.solicitante}</span>
                  <strong>{item.total}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">
            <h3 className="text-base font-black text-amber-900">Alertas de centro de custo</h3>
            <ul className="mt-3 space-y-2 text-sm text-amber-900">
              {data.alertaCentrosProximosLimite.length === 0 && <li>Sem alertas no momento.</li>}
              {data.alertaCentrosProximosLimite.map((item) => (
                <li key={item.codigo} className="rounded-lg bg-amber-100 px-3 py-2">
                  {item.codigo} com {Number(item.percentual).toFixed(2)}% utilizado
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </ProtectedPage>
  )
}
