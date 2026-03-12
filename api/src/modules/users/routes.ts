import argon2 from 'argon2'
import { z } from 'zod'
import { requireRoles } from '../../common/roles'
import { isCorporateEmail, validateStrongPassword } from '../../common/security'
import { env } from '../../config/env'
import { query } from '../../infra/db/pool'
import { createAuditLog } from '../auditoria/service'

const createUserSchema = z.object({
  nome: z.string().min(3),
  email: z.email().transform((value) => value.toLowerCase().trim()),
  senha: z.string().min(12),
  cargo: z.string().min(2),
  departamento: z.string().min(2),
  role: z.enum(['SOLICITANTE', 'APROVADOR', 'COMPRADOR', 'ADMINISTRADOR'])
})

export async function usersRoutes(app: any) {
  app.get('/users', { preHandler: [requireRoles(['ADMINISTRADOR'])] }, async () => {
    const { rows } = await query<{
      id: string
      nome: string
      email: string
      cargo: string
      departamento: string
      role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'
      ativo: boolean
      created_at: Date
    }>(
      `
        SELECT id, nome, email::text, cargo, departamento, role, ativo, created_at
        FROM usuarios
        ORDER BY created_at DESC
      `
    )

    return rows
  })

  app.get('/users/approvers', { preHandler: [requireRoles(['SOLICITANTE', 'ADMINISTRADOR'])] }, async () => {
    const { rows } = await query<{ id: string; nome: string; email: string }>(
      `
        SELECT id, nome, email::text
        FROM usuarios
        WHERE role = 'APROVADOR' AND ativo = TRUE
      `
    )

    return rows
  })

  app.post('/users', { preHandler: [requireRoles(['ADMINISTRADOR'])] }, async (request: any) => {
    const body = createUserSchema.parse(request.body)

    if (!isCorporateEmail(body.email, env.CORPORATE_DOMAIN)) {
      return { message: 'Email deve ser corporativo' }
    }

    if (!validateStrongPassword(body.senha)) {
      return { message: 'Senha nao atende aos requisitos de seguranca' }
    }

    const hash = await argon2.hash(body.senha)

    const { rows } = await query<{ id: string }>(
      `
        INSERT INTO usuarios (nome, email, senha_hash, cargo, departamento, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [body.nome, body.email, hash, body.cargo, body.departamento, body.role]
    )

    await createAuditLog({
      usuarioId: request.user.sub,
      acao: 'CREATE',
      entidade: 'usuarios',
      entidadeId: rows[0]?.id,
      dadosNovos: { ...body, senha: undefined },
      request
    })

    return { id: rows[0]?.id }
  })
}
