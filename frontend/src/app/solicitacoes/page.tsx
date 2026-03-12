'use client'

import { useEffect, useState } from 'react'
import { ProtectedPage } from '@/components/layout/protected-page'
import { apiRequest } from '@/lib/api'
import { getSessionUser } from '@/lib/session'
import { Button } from '@/components/ui/button'

type RequestItem = {
  id: string
  origem: string
  destino: string
  data_partida: string
  data_retorno: string
  status: 'EM_ANALISE' | 'APROVADO' | 'REJEITADO' | 'COMPRADO'
  cancelado: boolean
  centro_custo_codigo: string
}

export default function SolicitacoesPage() {
  const [items, setItems] = useState<RequestItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR' | null>(null)
  const [form, setForm] = useState({
    centroCustoCodigo: '',
    centroCustoDepartamento: '',
    origem: '',
    destino: '',
    dataPartida: '',
    dataRetorno: '',
    precisaBagagem: false,
    precisaHotel: false,
    precisaCarro: false,
    motivoViagem: '',
    observacoes: ''
  })

  async function load() {
    try {
      const data = await apiRequest<RequestItem[]>('/requests')
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar solicitacoes')
    }
  }

  useEffect(() => {
    const user = getSessionUser()
    setRole(user?.role ?? null)
    load()
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await apiRequest('/requests', {
        method: 'POST',
        body: form
      })
      setForm({
        centroCustoCodigo: '',
        centroCustoDepartamento: '',
        origem: '',
        destino: '',
        dataPartida: '',
        dataRetorno: '',
        precisaBagagem: false,
        precisaHotel: false,
        precisaCarro: false,
        motivoViagem: '',
        observacoes: ''
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar solicitacao')
    } finally {
      setLoading(false)
    }
  }

  async function cancel(id: string) {
    try {
      await apiRequest(`/requests/${id}/cancel`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar solicitacao')
    }
  }

  return (
    <ProtectedPage>
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      {role === 'SOLICITANTE' && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Codigo centro de custo" value={form.centroCustoCodigo} onChange={(e) => setForm((old) => ({ ...old, centroCustoCodigo: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Departamento do centro de custo" value={form.centroCustoDepartamento} onChange={(e) => setForm((old) => ({ ...old, centroCustoDepartamento: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Origem" value={form.origem} onChange={(e) => setForm((old) => ({ ...old, origem: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Destino" value={form.destino} onChange={(e) => setForm((old) => ({ ...old, destino: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.dataPartida} onChange={(e) => setForm((old) => ({ ...old, dataPartida: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.dataRetorno} onChange={(e) => setForm((old) => ({ ...old, dataRetorno: e.target.value }))} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Motivo da viagem" value={form.motivoViagem} onChange={(e) => setForm((old) => ({ ...old, motivoViagem: e.target.value }))} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Observacoes" value={form.observacoes} onChange={(e) => setForm((old) => ({ ...old, observacoes: e.target.value }))} />

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.precisaBagagem} onChange={(e) => setForm((old) => ({ ...old, precisaBagagem: e.target.checked }))} />Bagagem</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.precisaHotel} onChange={(e) => setForm((old) => ({ ...old, precisaHotel: e.target.checked }))} />Hotel</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.precisaCarro} onChange={(e) => setForm((old) => ({ ...old, precisaCarro: e.target.checked }))} />Carro</label>

          <Button disabled={loading} className="md:col-span-2">
            {loading ? 'Salvando...' : 'Criar solicitacao'}
          </Button>
        </form>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black">{item.origem} → {item.destino}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status}{item.cancelado ? ' / CANCELADO' : ''}</span>
            </div>
            <p className="mt-2 text-xs text-slate-600">Centro de custo: {item.centro_custo_codigo}</p>
            <p className="text-xs text-slate-600">Periodo: {item.data_partida.slice(0, 10)} ate {item.data_retorno.slice(0, 10)}</p>

            {role === 'SOLICITANTE' && !item.cancelado && item.status !== 'COMPRADO' && (
              <Button variant="outline" className="mt-3" onClick={() => cancel(item.id)}>
                Cancelar
              </Button>
            )}
          </article>
        ))}

        {items.length === 0 && <p className="text-sm text-slate-500">Nenhuma solicitacao encontrada.</p>}
      </div>
    </ProtectedPage>
  )
}
