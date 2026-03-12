"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const argon2_1 = __importDefault(require("argon2"));
const zod_1 = require("zod");
const crypto_1 = require("../../common/crypto");
const http_error_1 = require("../../common/http-error");
const security_1 = require("../../common/security");
const env_1 = require("../../config/env");
const service_1 = require("../auditoria/service");
const service_2 = require("../notificacoes/service");
const pool_1 = require("../../infra/db/pool");
const loginBodySchema = zod_1.z.object({
    email: zod_1.z.email().transform((value) => value.toLowerCase().trim()),
    senha: zod_1.z.string().min(1)
});
const resetRequestBodySchema = zod_1.z.object({
    email: zod_1.z.email().transform((value) => value.toLowerCase().trim())
});
const resetPasswordBodySchema = zod_1.z.object({
    token: zod_1.z.string().min(20),
    novaSenha: zod_1.z.string().min(12)
});
async function authRoutes(app) {
    app.post('/auth/login', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '1 minute'
            }
        }
    }, async (request, reply) => {
        const body = loginBodySchema.parse(request.body);
        if (!(0, security_1.isCorporateEmail)(body.email, env_1.env.CORPORATE_DOMAIN)) {
            await (0, service_1.createAuditLog)({
                acao: 'LOGIN_FAIL',
                entidade: 'usuarios',
                dadosNovos: { email: body.email, reason: 'INVALID_DOMAIN' },
                request
            });
            throw new http_error_1.HttpError(401, 'Credenciais invalidas');
        }
        const { rows } = await (0, pool_1.query)(`SELECT id, nome, email::text, senha_hash, role, ativo, failed_login_count, locked_until FROM usuarios WHERE email = $1`, [body.email]);
        const user = rows[0];
        if (!user || !user.ativo) {
            await (0, service_1.createAuditLog)({
                acao: 'LOGIN_FAIL',
                entidade: 'usuarios',
                dadosNovos: { email: body.email, reason: 'NOT_FOUND_OR_INACTIVE' },
                request
            });
            throw new http_error_1.HttpError(401, 'Credenciais invalidas');
        }
        if (user.locked_until && user.locked_until > new Date()) {
            await (0, service_1.createAuditLog)({
                usuarioId: user.id,
                acao: 'LOGIN_FAIL',
                entidade: 'usuarios',
                entidadeId: user.id,
                dadosNovos: { reason: 'LOCKED_USER' },
                request
            });
            throw new http_error_1.HttpError(423, 'Usuario temporariamente bloqueado por tentativas invalidas');
        }
        const isValidPassword = await argon2_1.default.verify(user.senha_hash, body.senha);
        if (!isValidPassword) {
            const failedCount = user.failed_login_count + 1;
            const lockedUntil = failedCount >= 5 ? (0, crypto_1.addMinutes)(new Date(), 15) : null;
            await (0, pool_1.query)(`
            UPDATE usuarios
            SET
              failed_login_count = $2,
              locked_until = $3,
              updated_at = NOW()
            WHERE id = $1
          `, [user.id, failedCount, lockedUntil]);
            await (0, service_1.createAuditLog)({
                usuarioId: user.id,
                acao: 'LOGIN_FAIL',
                entidade: 'usuarios',
                entidadeId: user.id,
                dadosNovos: { reason: 'INVALID_PASSWORD', failedCount },
                request
            });
            throw new http_error_1.HttpError(401, 'Credenciais invalidas');
        }
        const accessToken = await reply.jwtSign({
            role: user.role,
            email: user.email,
            nome: user.nome
        }, {
            sub: user.id,
            expiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN
        });
        const refreshTokenRaw = (0, crypto_1.generateSecureToken)();
        const refreshTokenHash = (0, crypto_1.hashToken)(refreshTokenRaw);
        const refreshExpiresAt = (0, crypto_1.addDays)(new Date(), 7);
        await (0, pool_1.query)(`
          INSERT INTO sessoes (usuario_id, refresh_token_hash, expira_em, ip, user_agent)
          VALUES ($1, $2, $3, $4, $5)
        `, [user.id, refreshTokenHash, refreshExpiresAt, request.ip, request.headers['user-agent'] ?? null]);
        await (0, pool_1.query)(`
          UPDATE usuarios
          SET
            failed_login_count = 0,
            locked_until = NULL,
            ultimo_login_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `, [user.id]);
        await (0, service_1.createAuditLog)({
            usuarioId: user.id,
            acao: 'LOGIN_SUCCESS',
            entidade: 'usuarios',
            entidadeId: user.id,
            request
        });
        reply.setCookie('refreshToken', refreshTokenRaw, {
            path: '/',
            httpOnly: true,
            secure: env_1.env.COOKIE_SECURE,
            sameSite: 'strict',
            expires: refreshExpiresAt
        });
        return {
            accessToken,
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                role: user.role
            }
        };
    });
    app.post('/auth/refresh', async (request, reply) => {
        const refreshTokenRaw = request.cookies.refreshToken;
        if (!refreshTokenRaw) {
            throw new http_error_1.HttpError(401, 'Sessao expirada');
        }
        const refreshTokenHash = (0, crypto_1.hashToken)(refreshTokenRaw);
        const { rows } = await (0, pool_1.query)(`
        SELECT s.usuario_id, s.expira_em, s.revogado_em, u.role, u.nome, u.email::text
        FROM sessoes s
        INNER JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.refresh_token_hash = $1
      `, [refreshTokenHash]);
        const session = rows[0];
        if (!session || session.revogado_em || session.expira_em < new Date()) {
            throw new http_error_1.HttpError(401, 'Sessao invalida');
        }
        const accessToken = await reply.jwtSign({
            role: session.role,
            email: session.email,
            nome: session.nome
        }, {
            sub: session.usuario_id,
            expiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN
        });
        return { accessToken };
    });
    app.post('/auth/logout', async (request, reply) => {
        const refreshTokenRaw = request.cookies.refreshToken;
        if (refreshTokenRaw) {
            await (0, pool_1.query)(`
          UPDATE sessoes
          SET revogado_em = NOW()
          WHERE refresh_token_hash = $1
        `, [(0, crypto_1.hashToken)(refreshTokenRaw)]);
        }
        reply.clearCookie('refreshToken', { path: '/' });
        return { ok: true };
    });
    app.get('/auth/me', async (request) => {
        await request.jwtVerify();
        const { rows } = await (0, pool_1.query)(`
        SELECT id, nome, email::text, role, departamento, cargo
        FROM usuarios
        WHERE id = $1
      `, [request.user.sub]);
        const user = rows[0];
        if (!user) {
            throw new http_error_1.HttpError(404, 'Usuario nao encontrado');
        }
        return user;
    });
    app.post('/auth/request-reset', async (request) => {
        const body = resetRequestBodySchema.parse(request.body);
        const { rows } = await (0, pool_1.query)(`SELECT id, nome, email::text FROM usuarios WHERE email = $1 AND ativo = TRUE`, [body.email]);
        const user = rows[0];
        if (user) {
            const tokenRaw = (0, crypto_1.generateSecureToken)(32);
            const tokenHash = (0, crypto_1.hashToken)(tokenRaw);
            const expiresAt = (0, crypto_1.addMinutes)(new Date(), 30);
            await (0, pool_1.query)(`
          INSERT INTO tokens_magic_link (usuario_id, token_hash, expira_em, ip_solicitacao)
          VALUES ($1, $2, $3, $4)
        `, [user.id, tokenHash, expiresAt, request.ip]);
            const resetUrl = `${env_1.env.FRONTEND_URL}/reset-password?token=${tokenRaw}`;
            await (0, service_2.queueEmail)({
                tipo: 'RECUPERACAO_SENHA',
                destinatario: user.email,
                assunto: 'Recuperacao de senha',
                payload: {
                    nome: user.nome,
                    url: resetUrl
                }
            });
            await (0, service_1.createAuditLog)({
                usuarioId: user.id,
                acao: 'PASSWORD_RESET_REQUEST',
                entidade: 'usuarios',
                entidadeId: user.id,
                request
            });
        }
        return {
            message: 'Se o email existir, um link de recuperacao sera enviado.'
        };
    });
    app.post('/auth/reset-password', async (request) => {
        const body = resetPasswordBodySchema.parse(request.body);
        if (!(0, security_1.validateStrongPassword)(body.novaSenha)) {
            throw new http_error_1.HttpError(400, 'Senha nao atende aos requisitos de seguranca');
        }
        const tokenHash = (0, crypto_1.hashToken)(body.token);
        const { rows } = await (0, pool_1.query)(`
        SELECT usuario_id
        FROM tokens_magic_link
        WHERE token_hash = $1
          AND usado_em IS NULL
          AND expira_em > NOW()
      `, [tokenHash]);
        const token = rows[0];
        if (!token) {
            throw new http_error_1.HttpError(400, 'Token invalido ou expirado');
        }
        const hash = await argon2_1.default.hash(body.novaSenha);
        await (0, pool_1.withTransaction)(async (client) => {
            await client.query(`
          UPDATE usuarios
          SET senha_hash = $2, updated_at = NOW(), failed_login_count = 0, locked_until = NULL
          WHERE id = $1
        `, [token.usuario_id, hash]);
            await client.query(`
          UPDATE tokens_magic_link
          SET usado_em = NOW()
          WHERE token_hash = $1
        `, [tokenHash]);
            await client.query(`
          UPDATE sessoes
          SET revogado_em = NOW()
          WHERE usuario_id = $1 AND revogado_em IS NULL
        `, [token.usuario_id]);
        });
        await (0, service_1.createAuditLog)({
            usuarioId: token.usuario_id,
            acao: 'PASSWORD_RESET_SUCCESS',
            entidade: 'usuarios',
            entidadeId: token.usuario_id,
            request
        });
        return { ok: true };
    });
}
