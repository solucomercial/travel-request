'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProtectedPage } from '@/components/layout/protected-page'
import { apiRequest } from '@/lib/api'

type User = {
  id: string
  nome: string
  email: string
  cargo: string
  departamento: string
  role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'
  ativo: boolean
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: '',
    departamento: '',
    role: 'SOLICITANTE'
  })

  async function load() {
    try {
      const data = await apiRequest<User[]>('/users')
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuarios')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: form
      })
      setForm({
        nome: '',
        email: '',
        senha: '',
        cargo: '',
        departamento: '',
        role: 'SOLICITANTE'
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar usuario')
    }
  }

  return (
    <ProtectedPage>
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Nome" value={form.nome} onChange={(e) => setForm((old) => ({ ...old, nome: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm((old) => ({ ...old, email: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Senha forte" type="password" value={form.senha} onChange={(e) => setForm((old) => ({ ...old, senha: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm((old) => ({ ...old, cargo: e.target.value }))} />
        <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Departamento" value={form.departamento} onChange={(e) => setForm((old) => ({ ...old, departamento: e.target.value }))} />
        <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.role} onChange={(e) => setForm((old) => ({ ...old, role: e.target.value }))}>
          <option>SOLICITANTE</option>
          <option>APROVADOR</option>
          <option>COMPRADOR</option>
          <option>ADMINISTRADOR</option>
        </select>
        <Button className="md:col-span-2">Criar usuario</Button>
      </form>

      <div className="space-y-2">
        {users.map((user) => (
          <article key={user.id} className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-black">{user.nome}</p>
            <p className="text-slate-600">{user.email}</p>
            <p className="text-slate-600">{user.departamento} - {user.cargo} - {user.role}</p>
          </article>
        ))}
      </div>
    </ProtectedPage>
  )
}
