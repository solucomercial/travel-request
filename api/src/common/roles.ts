type Role = 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'

export function requireRoles(roles: Role[]) {
  return async function (request: any, reply: any) {
    await request.jwtVerify()
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({ message: 'Acesso negado' })
    }
  }
}
