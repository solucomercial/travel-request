# API - Sistema de Viagens Corporativas

Backend em Fastify responsavel por autenticacao, regras de negocio, auditoria, notificacoes e dashboard.

## Tecnologias

- Node.js
- Fastify
- PostgreSQL
- Zod
- Argon2
- JWT
- Nodemailer

## Estrutura

```
src
├── common
├── config
├── infra
│   ├── db
│   ├── email
│   └── scheduler
├── modules
│   ├── auth
│   ├── users
│   ├── solicitacoes
│   ├── dashboard
│   ├── auditoria
│   ├── notificacoes
│   └── relatorios
└── server.ts
```

## Variaveis de Ambiente

Use o arquivo .env.example como base.

Variaveis principais:

- PORT
- DATABASE_URL
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- JWT_ACCESS_EXPIRES_IN
- JWT_REFRESH_EXPIRES_IN
- COOKIE_SECURE
- CORPORATE_DOMAIN
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- EMAIL_FROM
- FRONTEND_URL

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:seed
npm run format
```

## Endpoints Principais

Autenticacao:

- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me
- POST /auth/request-reset
- POST /auth/reset-password

Usuarios:

- GET /users
- GET /users/approvers
- POST /users

Solicitacoes:

- POST /requests
- GET /requests
- POST /requests/:id/approve
- POST /requests/:id/reject
- POST /requests/:id/cancel
- POST /requests/:id/purchases

Dashboard e Relatorios:

- GET /dashboard/summary
- POST /reports/monthly/trigger

Saude e docs:

- GET /health
- GET /docs

## Regras de Seguranca

- Login restrito ao dominio corporativo.
- Senha forte obrigatoria.
- Rate limit no endpoint de login.
- Bloqueio temporario por tentativas de senha incorreta.
- Sessao com access token + refresh token.

## Auditoria

Todas as acoes criticas escrevem em logs_auditoria com:

- usuario_id
- acao
- entidade
- entidade_id
- dados_anteriores
- dados_novos
- ip
- user_agent
- request_id

## Emails

Eventos enviados por outbox:

- solicitacao criada
- solicitacao aprovada
- solicitacao rejeitada
- compra realizada
- recuperacao de senha
- relatorio mensal

## Banco de Dados

Schema SQL em:

- src/infra/db/schema.sql

Inicializacao automatica ao subir servidor via:

- src/infra/db/init.ts

## Job de Relatorio Mensal

Configurado em:

- src/infra/scheduler/jobs.ts

Frequencia:

- processamento de outbox: a cada minuto
- relatorio mensal: dia 1, 08:00

## Validacao Manual Recomendada

1. Fazer login com usuario de seed.
2. Criar solicitacao com solicitante.
3. Aprovar ou rejeitar com aprovador.
4. Registrar compra com comprador.
5. Confirmar atualizacao de centro de custo.
6. Conferir logs de auditoria e outbox de email.

## Troubleshooting

Problemas comuns:

- Falha de conexao com banco: validar DATABASE_URL.
- Emails nao enviados: validar SMTP\_\* e Mailpit.
- 401 em rotas protegidas: verificar access token e refresh cookie.
- 403 em aprovacao: aprovador tentando aprovar solicitacao propria.
