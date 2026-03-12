'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''
  const [novaSenha, setNovaSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { token, novaSenha }
      })
      alert('Senha redefinida com sucesso')
      router.push('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">Redefinir senha</h1>
        <p className="mt-1 text-sm text-slate-500">Use uma senha forte com no minimo 12 caracteres.</p>

        <label className="mt-5 block text-sm font-semibold text-slate-700">Nova senha</label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2 outline-none ring-sky-500 transition focus:ring-2"
          value={novaSenha}
          onChange={(event) => setNovaSenha(event.target.value)}
          type="password"
          placeholder="Nova senha"
        />

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <Button className="mt-5 w-full" type="submit" disabled={loading || !token}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-sm text-slate-600">Carregando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
