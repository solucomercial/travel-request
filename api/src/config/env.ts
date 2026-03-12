import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32).default('dev-access-secret-dev-access-secret-1234'),
  JWT_REFRESH_SECRET: z.string().min(32).default('dev-refresh-secret-dev-refresh-secret-1234'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  CORPORATE_DOMAIN: z.string().default('solucoesterceirizadas.com.br'),
  SMTP_HOST: z.string().default('mailpit'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@solucoesterceirizadas.com.br'),
  FRONTEND_URL: z.string().default('http://localhost:3000')
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`)
}

export const env = parsed.data
