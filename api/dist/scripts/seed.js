"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const argon2_1 = __importDefault(require("argon2"));
const init_1 = require("../infra/db/init");
const pool_1 = require("../infra/db/pool");
async function upsertUser(data) {
    const hash = await argon2_1.default.hash(data.senha);
    await (0, pool_1.query)(`
      INSERT INTO usuarios (nome, email, senha_hash, cargo, departamento, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email)
      DO UPDATE SET
        nome = EXCLUDED.nome,
        senha_hash = EXCLUDED.senha_hash,
        cargo = EXCLUDED.cargo,
        departamento = EXCLUDED.departamento,
        role = EXCLUDED.role,
        updated_at = NOW()
    `, [data.nome, data.email, hash, data.cargo, data.departamento, data.role]);
}
async function run() {
    await (0, init_1.initializeDatabase)();
    await upsertUser({
        nome: 'Administrador Sistema',
        email: 'admin@solucoesterceirizadas.com.br',
        senha: 'Admin@12345678',
        role: 'ADMINISTRADOR',
        cargo: 'Administrador',
        departamento: 'TI'
    });
    await upsertUser({
        nome: 'Aprovador Financeiro',
        email: 'aprovador@solucoesterceirizadas.com.br',
        senha: 'Aprovador@12345',
        role: 'APROVADOR',
        cargo: 'Coordenador',
        departamento: 'Financeiro'
    });
    await upsertUser({
        nome: 'Comprador Corporativo',
        email: 'comprador@solucoesterceirizadas.com.br',
        senha: 'Comprador@12345',
        role: 'COMPRADOR',
        cargo: 'Analista',
        departamento: 'Suprimentos'
    });
    await upsertUser({
        nome: 'Solicitante Padrão',
        email: 'solicitante@solucoesterceirizadas.com.br',
        senha: 'Solicitante@12345',
        role: 'SOLICITANTE',
        cargo: 'Analista',
        departamento: 'Operações'
    });
    console.log('Seed executado com sucesso');
}
run().catch((error) => {
    console.error(error);
    process.exit(1);
});
