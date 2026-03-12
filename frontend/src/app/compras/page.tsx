'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProtectedPage } from '@/components/layout/protected-page'
import { apiRequest } from '@/lib/api'

type Item = {
  id: string
  origem: string
  destino: string
  status: 'EM_ANALISE' | 'APROVADO' | 'REJEITADO' | 'COMPRADO'
}

export default function ComprasPage() {
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await apiRequest<Item[]>('/requests')
      setItems(data.filter((item) => item.status === 'APROVADO'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar compras')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function registerPurchase(id: string) {
    const tipo = prompt('Tipo da compra (PASSAGEM/HOTEL/CARRO):')
    const codigoReserva = prompt('Codigo da reserva:')
    const valorRaw = prompt('Valor da compra:')

    if (!tipo || !codigoReserva || !valorRaw) {
      return
    }

    try {
      await apiRequest(`/requests/${id}/purchases`, {
        method: 'POST',
        body: {
          tipo,
          codigoReserva,
          valor: Number(valorRaw)
        }
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar compra')
    }
  }

  return (
    <ProtectedPage>
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-black">{item.origem} → {item.destino}</h3>
            <Button className="mt-3" onClick={() => registerPurchase(item.id)}>
              Registrar compra
            </Button>
          </article>
        ))}

        {items.length === 0 && <p className="text-sm text-slate-500">Nao ha solicitacoes aprovadas pendentes de compra.</p>}
      </div>
    </ProtectedPage>
  )
}
