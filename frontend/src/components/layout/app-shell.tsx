'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { clearSession, getSessionUser } from '@/lib/session'
import { useEffect, useMemo, useState } from 'react'

const menuByRole = {
  SOLICITANTE: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/solicitacoes', label: 'Minhas Solicitacoes' }
  ],
  APROVADOR: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/aprovacoes', label: 'Aprovacoes' }
  ],
  COMPRADOR: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/compras', label: 'Compras' }
  ],
  ADMINISTRADOR: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/solicitacoes', label: 'Solicitacoes' },
    { href: '/aprovacoes', label: 'Aprovacoes' },
    { href: '/compras', label: 'Compras' },
    { href: '/admin/users', label: 'Usuarios' }
  ]
} as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [links, setLinks] = useState<Array<{ href: string; label: string }>>([])

  useEffect(() => {
    const user = getSessionUser()
    if (!user) {
      router.replace('/login')
      return
    }
    setUserName(user.nome)
    setLinks([...menuByRole[user.role]])
  }, [router])

  const title = useMemo(() => {
    const active = links.find((item) => item.href === pathname)
    return active?.label ?? 'Painel'
  }, [links, pathname])

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } finally {
      clearSession()
      router.replace('/login')
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_40%,#f8fafc_100%)] text-slate-900">
      <header className="border-b border-slate-200 bg-white/75 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.35em] text-sky-600">SISTEMA INTERNO</p>
            <h1 className="text-2xl font-black text-slate-900">Viagens Corporativas</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm">{userName}</span>
            <Button onClick={logout} variant="outline">
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  pathname === link.href
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-black tracking-tight">{title}</h2>
          {children}
        </main>
      </div>
    </div>
  )
}
