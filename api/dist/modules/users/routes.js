"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRoutes = usersRoutes;
const argon2_1 = __importDefault(require("argon2"));
const zod_1 = require("zod");
const roles_1 = require("../../common/roles");
const security_1 = require("../../common/security");
const env_1 = require("../../config/env");
const pool_1 = require("../../infra/db/pool");
const service_1 = require("../auditoria/service");
const createUserSchema = zod_1.z.object({
    nome: zod_1.z.string().min(3),
    email: zod_1.z.email().transform((value) => value.toLowerCase().trim()),
    senha: zod_1.z.string().min(12),
    cargo: zod_1.z.string().min(2),
    departamento: zod_1.z.string().min(2),
    role: zod_1.z.enum(['SOLICITANTE', 'APROVADOR', 'COMPRADOR', 'ADMINISTRADOR'])
});
async function usersRoutes(app) {
    app.get('/users', { preHandler: [(0, roles_1.requireRoles)(['ADMINISTRADOR'])] }, async () => {
        const { rows } = await (0, pool_1.query)(`
        SELECT id, nome, email::text, cargo, departamento, role, ativo, created_at
        FROM usuarios
        ORDER BY created_at DESC
      `);
        return rows;
    });
    app.get('/users/approvers', { preHandler: [(0, roles_1.requireRoles)(['SOLICITANTE', 'ADMINISTRADOR'])] }, async () => {
        const { rows } = await (0, pool_1.query)(`
        SELECT id, nome, email::text
        FROM usuarios
        WHERE role = 'APROVADOR' AND ativo = TRUE
      `);
        return rows;
    });
    app.post('/users', { preHandler: [(0, roles_1.requireRoles)(['ADMINISTRADOR'])] }, async (request) => {
        const body = createUserSchema.parse(request.body);
        if (!(0, security_1.isCorporateEmail)(body.email, env_1.env.CORPORATE_DOMAIN)) {
            return { message: 'Email deve ser corporativo' };
        }
        if (!(0, security_1.validateStrongPassword)(body.senha)) {
            return { message: 'Senha nao atende aos requisitos de seguranca' };
        }
        const hash = await argon2_1.default.hash(body.senha);
        const { rows } = await (0, pool_1.query)(`
        INSERT INTO usuarios (nome, email, senha_hash, cargo, departamento, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [body.nome, body.email, hash, body.cargo, body.departamento, body.role]);
        await (0, service_1.createAuditLog)({
            usuarioId: request.user.sub,
            acao: 'CREATE',
            entidade: 'usuarios',
            entidadeId: rows[0]?.id,
            dadosNovos: { ...body, senha: undefined },
            request
        });
        return { id: rows[0]?.id };
    });
}
