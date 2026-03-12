import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'
      email: string
      nome: string
    }
    user: {
      sub: string
      role: 'SOLICITANTE' | 'APROVADOR' | 'COMPRADOR' | 'ADMINISTRADOR'
      email: string
      nome: string
    }
  }
}
