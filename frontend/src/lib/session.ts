export type Role = 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'

export interface SessionUser {
  id: string
  nome: string
  email: string
  role: Role
  departamento?: string
  cargo?: string
}

const TOKEN_KEY = 'travel_access_token'
const USER_KEY = 'travel_user'

export function saveSession(accessToken: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
