import argon2 from 'argon2'
import { z } from 'zod'
import { addDays, addMinutes, generateSecureToken, hashToken } from '../../common/crypto'
import { HttpError } from '../../common/http-error'
import { isCorporateEmail, validateStrongPassword } from '../../common/security'
import { env } from '../../config/env'
import { createAuditLog } from '../auditoria/service'
import { queueEmail } from '../notificacoes/service'
import { query, withTransaction } from '../../infra/db/pool'

interface UserRow {
  id: string
  nome: string
  email: string
  senha_hash: string
  role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'
  ativo: boolean
  failed_login_count: number
  locked_until: Date | null
}

const loginBodySchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
  senha: z.string().min(1)
})

const resetRequestBodySchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim())
})

const resetPasswordBodySchema = z.object({
  token: z.string().min(20),
  novaSenha: z.string().min(12)
})

export async function authRoutes(app: any) {
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      }
    },
    async (request: any, reply: any) => {
      const body = loginBodySchema.parse(request.body)

      if (!isCorporateEmail(body.email, env.CORPORATE_DOMAIN)) {
        await createAuditLog({
          acao: 'LOGIN_FAIL',
          entidade: 'usuarios',
          dadosNovos: { email: body.email, reason: 'INVALID_DOMAIN' },
          request
        })
        throw new HttpError(401, 'Credenciais invalidas')
      }

      const { rows } = await query<UserRow>(
        `SELECT id, nome, email::text, senha_hash, role, ativo, failed_login_count, locked_until FROM usuarios WHERE email = $1`,
        [body.email]
      )

      const user = rows[0]
      if (!user || !user.ativo) {
        await createAuditLog({
          acao: 'LOGIN_FAIL',
          entidade: 'usuarios',
          dadosNovos: { email: body.email, reason: 'NOT_FOUND_OR_INACTIVE' },
          request
        })
        throw new HttpError(401, 'Credenciais invalidas')
      }

      if (user.locked_until && user.locked_until > new Date()) {
        await createAuditLog({
          usuarioId: user.id,
          acao: 'LOGIN_FAIL',
          entidade: 'usuarios',
          entidadeId: user.id,
          dadosNovos: { reason: 'LOCKED_USER' },
          request
        })
        throw new HttpError(423, 'Usuario temporariamente bloqueado por tentativas invalidas')
      }

      const isValidPassword = await argon2.verify(user.senha_hash, body.senha)
      if (!isValidPassword) {
        const failedCount = user.failed_login_count + 1
        const lockedUntil = failedCount >= 5 ? addMinutes(new Date(), 15) : null

        await query(
          `
            UPDATE usuarios
            SET
              failed_login_count = $2,
              locked_until = $3,
              updated_at = NOW()
            WHERE id = $1
          `,
          [user.id, failedCount, lockedUntil]
        )

        await createAuditLog({
          usuarioId: user.id,
          acao: 'LOGIN_FAIL',
          entidade: 'usuarios',
          entidadeId: user.id,
          dadosNovos: { reason: 'INVALID_PASSWORD', failedCount },
          request
        })

        throw new HttpError(401, 'Credenciais invalidas')
      }

      const accessToken = await reply.jwtSign(
        {
          role: user.role,
          email: user.email,
          nome: user.nome
        },
        {
          sub: user.id,
          expiresIn: env.JWT_ACCESS_EXPIRES_IN
        }
      )

      const refreshTokenRaw = generateSecureToken()
      const refreshTokenHash = hashToken(refreshTokenRaw)
      const refreshExpiresAt = addDays(new Date(), 7)

      await query(
        `
          INSERT INTO sessoes (usuario_id, refresh_token_hash, expira_em, ip, user_agent)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [user.id, refreshTokenHash, refreshExpiresAt, request.ip, request.headers['user-agent'] ?? null]
      )

      await query(
        `
          UPDATE usuarios
          SET
            failed_login_count = 0,
            locked_until = NULL,
            ultimo_login_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [user.id]
      )

      await createAuditLog({
        usuarioId: user.id,
        acao: 'LOGIN_SUCCESS',
        entidade: 'usuarios',
        entidadeId: user.id,
        request
      })

      reply.setCookie('refreshToken', refreshTokenRaw, {
        path: '/',
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'strict',
        expires: refreshExpiresAt
      })

      return {
        accessToken,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role
        }
      }
    }
  )

  app.post('/auth/refresh', async (request: any, reply: any) => {
    const refreshTokenRaw = request.cookies.refreshToken
    if (!refreshTokenRaw) {
      throw new HttpError(401, 'Sessao expirada')
    }

    const refreshTokenHash = hashToken(refreshTokenRaw)
    const { rows } = await query<{
      usuario_id: string
      expira_em: Date
      revogado_em: Date | null
      role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'
      nome: string
      email: string
    }>(
      `
        SELECT s.usuario_id, s.expira_em, s.revogado_em, u.role, u.nome, u.email::text
        FROM sessoes s
        INNER JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.refresh_token_hash = $1
      `,
      [refreshTokenHash]
    )

    const session = rows[0]
    if (!session || session.revogado_em || session.expira_em < new Date()) {
      throw new HttpError(401, 'Sessao invalida')
    }

    const accessToken = await reply.jwtSign(
      {
        role: session.role,
        email: session.email,
        nome: session.nome
      },
      {
        sub: session.usuario_id,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN
      }
    )

    return { accessToken }
  })

  app.post('/auth/logout', async (request: any, reply: any) => {
    const refreshTokenRaw = request.cookies.refreshToken
    if (refreshTokenRaw) {
      await query(
        `
          UPDATE sessoes
          SET revogado_em = NOW()
          WHERE refresh_token_hash = $1
        `,
        [hashToken(refreshTokenRaw)]
      )
    }

    reply.clearCookie('refreshToken', { path: '/' })
    return { ok: true }
  })

  app.get('/auth/me', async (request: any) => {
    await request.jwtVerify()

    const { rows } = await query<{
      id: string
      nome: string
      email: string
      role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'
      departamento: string | null
      cargo: string | null
    }>(
      `
        SELECT id, nome, email::text, role, departamento, cargo
        FROM usuarios
        WHERE id = $1
      `,
      [request.user.sub]
    )

    const user = rows[0]
    if (!user) {
      throw new HttpError(404, 'Usuario nao encontrado')
    }

    return user
  })

  app.post('/auth/request-reset', async (request: any) => {
    const body = resetRequestBodySchema.parse(request.body)

    const { rows } = await query<{ id: string; nome: string; email: string }>(
      `SELECT id, nome, email::text FROM usuarios WHERE email = $1 AND ativo = TRUE`,
      [body.email]
    )

    const user = rows[0]
    if (user) {
      const tokenRaw = generateSecureToken(32)
      const tokenHash = hashToken(tokenRaw)
      const expiresAt = addMinutes(new Date(), 30)

      await query(
        `
          INSERT INTO tokens_magic_link (usuario_id, token_hash, expira_em, ip_solicitacao)
          VALUES ($1, $2, $3, $4)
        `,
        [user.id, tokenHash, expiresAt, request.ip]
      )

      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${tokenRaw}`
      await queueEmail({
        tipo: 'RECUPERACAO_SENHA',
        destinatario: user.email,
        assunto: 'Recuperacao de senha',
        payload: {
          nome: user.nome,
          url: resetUrl
        }
      })

      await createAuditLog({
        usuarioId: user.id,
        acao: 'PASSWORD_RESET_REQUEST',
        entidade: 'usuarios',
        entidadeId: user.id,
        request
      })
    }

    return {
      message: 'Se o email existir, um link de recuperacao sera enviado.'
    }
  })

  app.post('/auth/reset-password', async (request: any) => {
    const body = resetPasswordBodySchema.parse(request.body)

    if (!validateStrongPassword(body.novaSenha)) {
      throw new HttpError(400, 'Senha nao atende aos requisitos de seguranca')
    }

    const tokenHash = hashToken(body.token)
    const { rows } = await query<{ usuario_id: string }>(
      `
        SELECT usuario_id
        FROM tokens_magic_link
        WHERE token_hash = $1
          AND usado_em IS NULL
          AND expira_em > NOW()
      `,
      [tokenHash]
    )

    const token = rows[0]
    if (!token) {
      throw new HttpError(400, 'Token invalido ou expirado')
    }

    const hash = await argon2.hash(body.novaSenha)

    await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE usuarios
          SET senha_hash = $2, updated_at = NOW(), failed_login_count = 0, locked_until = NULL
          WHERE id = $1
        `,
        [token.usuario_id, hash]
      )

      await client.query(
        `
          UPDATE tokens_magic_link
          SET usado_em = NOW()
          WHERE token_hash = $1
        `,
        [tokenHash]
      )

      await client.query(
        `
          UPDATE sessoes
          SET revogado_em = NOW()
          WHERE usuario_id = $1 AND revogado_em IS NULL
        `,
        [token.usuario_id]
      )
    })

    await createAuditLog({
      usuarioId: token.usuario_id,
      acao: 'PASSWORD_RESET_SUCCESS',
      entidade: 'usuarios',
      entidadeId: token.usuario_id,
      request
    })

    return { ok: true }
  })
}
