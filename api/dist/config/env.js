"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = require("dotenv");
const zod_1 = require("zod");
(0, dotenv_1.config)();
const EnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().default(3333),
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32).default('dev-access-secret-dev-access-secret-1234'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32).default('dev-refresh-secret-dev-refresh-secret-1234'),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    COOKIE_SECURE: zod_1.z.coerce.boolean().default(false),
    CORPORATE_DOMAIN: zod_1.z.string().default('solucoesterceirizadas.com.br'),
    SMTP_HOST: zod_1.z.string().default('mailpit'),
    SMTP_PORT: zod_1.z.coerce.number().default(1025),
    SMTP_USER: zod_1.z.string().default(''),
    SMTP_PASS: zod_1.z.string().default(''),
    EMAIL_FROM: zod_1.z.string().default('noreply@solucoesterceirizadas.com.br'),
    FRONTEND_URL: zod_1.z.string().default('http://localhost:3000')
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}
exports.env = parsed.data;
