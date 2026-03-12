"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const fastify_type_provider_zod_1 = require("fastify-type-provider-zod");
const swagger_1 = require("@fastify/swagger");
const cors_1 = require("@fastify/cors");
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const fastify_api_reference_1 = __importDefault(require("@scalar/fastify-api-reference"));
const env_1 = require("./config/env");
const init_1 = require("./infra/db/init");
const http_error_1 = require("./common/http-error");
const routes_1 = require("./modules/auth/routes");
const routes_2 = require("./modules/users/routes");
const routes_3 = require("./modules/solicitacoes/routes");
const routes_4 = require("./modules/dashboard/routes");
const routes_5 = require("./modules/relatorios/routes");
const jobs_1 = require("./infra/scheduler/jobs");
const app = (0, fastify_1.default)().withTypeProvider();
app.setValidatorCompiler(fastify_type_provider_zod_1.validatorCompiler);
app.setSerializerCompiler(fastify_type_provider_zod_1.serializerCompiler);
app.register(cors_1.fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
});
app.register(cookie_1.default);
app.register(rate_limit_1.default, {
    global: false,
    max: 120,
    timeWindow: '1 minute'
});
app.register(jwt_1.default, {
    secret: env_1.env.JWT_ACCESS_SECRET
});
app.register(swagger_1.fastifySwagger, {
    openapi: {
        info: {
            title: 'Sistema Corporativo de Viagens',
            description: 'API de solicitacoes, aprovacoes, compras e auditoria',
            version: '1.0.0',
        },
    },
    transform: fastify_type_provider_zod_1.jsonSchemaTransform,
});
app.register(fastify_api_reference_1.default, {
    routePrefix: '/docs',
});
app.get('/health', async () => {
    return { ok: true, timestamp: new Date().toISOString() };
});
app.register(routes_1.authRoutes);
app.register(routes_2.usersRoutes);
app.register(routes_3.solicitacoesRoutes);
app.register(routes_4.dashboardRoutes);
app.register(routes_5.relatoriosRoutes);
app.setErrorHandler((error, _request, reply) => {
    const typedError = error;
    if (error instanceof http_error_1.HttpError) {
        return reply.status(error.statusCode).send({ message: error.message });
    }
    if (typedError && typeof typedError === 'object' && typedError.issues) {
        const details = typedError.issues;
        return reply.status(400).send({ message: 'Erro de validacao', details });
    }
    app.log.error(error);
    return reply.status(500).send({ message: 'Erro interno no servidor' });
});
async function bootstrap() {
    await (0, init_1.initializeDatabase)();
    (0, jobs_1.startJobs)();
    await app.listen({ port: env_1.env.PORT, host: '0.0.0.0' });
    console.log(`HTTP server running on http://localhost:${env_1.env.PORT}`);
    console.log(`Docs available at http://localhost:${env_1.env.PORT}/docs`);
}
bootstrap().catch((error) => {
    app.log.error(error);
    process.exit(1);
});
