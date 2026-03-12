'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from './app-shell'
import { getSessionUser } from '@/lib/session'

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const user = getSessionUser()
    if (!user) {
      router.replace('/login')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm font-semibold text-slate-500">Carregando...</p>
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
