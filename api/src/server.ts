import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider
} from 'fastify-type-provider-zod'
import { fastifySwagger } from '@fastify/swagger'
import { fastifyCors } from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyRateLimit from '@fastify/rate-limit'
import ScalarApiReference from '@scalar/fastify-api-reference'
import { env } from './config/env'
import { initializeDatabase } from './infra/db/init'
import { HttpError } from './common/http-error'
import { authRoutes } from './modules/auth/routes'
import { usersRoutes } from './modules/users/routes'
import { solicitacoesRoutes } from './modules/solicitacoes/routes'
import { dashboardRoutes } from './modules/dashboard/routes'
import { relatoriosRoutes } from './modules/relatorios/routes'
import { startJobs } from './infra/scheduler/jobs'

const app = fastify().withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
})

app.register(fastifyCookie)

app.register(fastifyRateLimit, {
  global: false,
  max: 120,
  timeWindow: '1 minute'
})

app.register(fastifyJwt, {
  secret: env.JWT_ACCESS_SECRET
})

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Sistema Corporativo de Viagens',
      description: 'API de solicitacoes, aprovacoes, compras e auditoria',
      version: '1.0.0',
    },
  },
  transform: jsonSchemaTransform,
})

app.register(ScalarApiReference, {
  routePrefix: '/docs',
})

app.get('/health', async () => {
  return { ok: true, timestamp: new Date().toISOString() }
})

app.register(authRoutes)
app.register(usersRoutes)
app.register(solicitacoesRoutes)
app.register(dashboardRoutes)
app.register(relatoriosRoutes)

app.setErrorHandler((error: any, _request: any, reply: any) => {
  const typedError = error as { issues?: unknown }

  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ message: error.message })
  }

  if (typedError && typeof typedError === 'object' && typedError.issues) {
    const details = typedError.issues
    return reply.status(400).send({ message: 'Erro de validacao', details })
  }

  app.log.error(error)
  return reply.status(500).send({ message: 'Erro interno no servidor' })
})

async function bootstrap() {
  await initializeDatabase()
  startJobs()

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`HTTP server running on http://localhost:${env.PORT}`)
  console.log(`Docs available at http://localhost:${env.PORT}/docs`)
}

bootstrap().catch((error) => {
  app.log.error(error)
  process.exit(1)
})