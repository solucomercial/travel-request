'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProtectedPage } from '@/components/layout/protected-page'
import { apiRequest } from '@/lib/api'

type Item = {
  id: string
  origem: string
  destino: string
  solicitante_nome: string
  status: string
}

export default function AprovacoesPage() {
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await apiRequest<Item[]>('/requests')
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar aprovacoes')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function approve(id: string) {
    try {
      await apiRequest(`/requests/${id}/approve`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aprovar')
    }
  }

  async function reject(id: string) {
    const justificativa = prompt('Informe a justificativa da rejeicao:')
    if (!justificativa) {
      return
    }

    try {
      await apiRequest(`/requests/${id}/reject`, {
        method: 'POST',
        body: { justificativa }
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao rejeitar')
    }
  }

  return (
    <ProtectedPage>
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-sky-700">Solicitante: {item.solicitante_nome}</p>
            <h3 className="mt-1 text-sm font-black">{item.origem} → {item.destino}</h3>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => approve(item.id)} className="bg-emerald-600 text-white hover:bg-emerald-500">Aprovar</Button>
              <Button onClick={() => reject(item.id)} variant="outline">Rejeitar</Button>
            </div>
          </article>
        ))}

        {items.length === 0 && <p className="text-sm text-slate-500">Nenhuma solicitacao em analise.</p>}
      </div>
    </ProtectedPage>
  )
}
