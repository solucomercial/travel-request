'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { saveSession } from '@/lib/session'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await apiRequest<{ accessToken: string; user: { id: string; nome: string; email: string; role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR' } }>('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, senha }
      })

      saveSession(result.accessToken, result.user)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel autenticar')
    } finally {
      setLoading(false)
    }
  }

  async function requestReset() {
    if (!email) {
      setError('Informe seu email para solicitar recuperacao de senha')
      return
    }

    setLoading(true)
    setError('')

    try {
      await apiRequest('/auth/request-reset', {
        method: 'POST',
        auth: false,
        body: { email }
      })
      alert('Se o email existir, um link de recuperacao foi enviado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao solicitar recuperacao')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#0ea5e966,transparent_28%),radial-gradient(circle_at_80%_30%,#1d4ed866,transparent_30%),radial-gradient(circle_at_60%_80%,#22d3ee44,transparent_24%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl">
        <p className="text-xs font-bold tracking-[0.35em] text-cyan-300">SOLUCOES</p>
        <h1 className="mt-2 text-3xl font-black">Portal de Viagens</h1>
        <p className="mt-2 text-sm text-slate-300">Acesso interno corporativo</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold">Email corporativo</label>
            <input
              className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-2 outline-none ring-cyan-400 transition focus:ring-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@solucoesterceirizadas.com.br"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Senha</label>
            <input
              className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-2 outline-none ring-cyan-400 transition focus:ring-2"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
            />
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <Button className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>

          <button
            type="button"
            onClick={requestReset}
            disabled={loading}
            className="w-full text-center text-sm font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Esqueci minha senha
          </button>
        </form>
      </div>
    </div>
  )
}
