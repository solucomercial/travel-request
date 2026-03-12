import { clearSession, getAccessToken, saveSession, type SessionUser } from './session'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

async function refreshAccessToken() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include'
  })

  if (!response.ok) {
    clearSession()
    return null
  }

  const data = (await response.json()) as { accessToken: string }
  const user = localStorage.getItem('travel_user')
  if (user) {
    saveSession(data.accessToken, JSON.parse(user) as SessionUser)
  }
  return data.accessToken
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (options.auth !== false) {
    const token = getAccessToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  if (response.status === 401 && options.auth !== false) {
    const token = await refreshAccessToken()
    if (token) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${token}`
      }
      const retry = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers: retryHeaders,
        credentials: 'include',
        body: options.body ? JSON.stringify(options.body) : undefined
      })

      if (!retry.ok) {
        throw new Error((await retry.json()).message ?? 'Erro na requisicao')
      }

      return (await retry.json()) as T
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro na requisicao' }))
    throw new Error(error.message ?? 'Erro na requisicao')
  }

  return (await response.json()) as T
}
