# Sistema de Viagens Corporativas

Sistema interno para solicitacao, aprovacao e compra de viagens corporativas.

## Objetivo

Entregar um fluxo auditavel e seguro para viagens corporativas com:

- autenticacao interna por email e senha
- recuperacao de senha por magic link
- aprovacao por papel
- compras com controle de centro de custo
- logs de auditoria
- dashboard de gastos e indicadores

## Stack

- Backend: Node.js, Fastify, PostgreSQL
- Frontend: Next.js, React, Shadcn UI
- Infra: Docker Compose
- Email em ambiente local: Mailpit

## Estrutura do Monorepo

```
.
├── api
├── frontend
├── docker-compose.yml
└── README.md
```

## Regras de Negocio Principais

- Status permitidos de solicitacao: EM_ANALISE, APROVADO, REJEITADO, COMPRADO
- Solicitante pode cancelar solicitacao antes da conclusao
- Aprovador nao pode aprovar/rejeitar solicitacao criada por ele mesmo
- Solicitante so visualiza as proprias solicitacoes
- Se centro de custo nao existir, ele e criado automaticamente com orcamento zero
- Registro de compra debita valor_utilizado do centro de custo
- Se ultrapassar orcamento anual, gera alerta e nao bloqueia compra

## Como Executar com Docker Compose

Pre-requisitos:

- Docker
- Docker Compose

Subir toda a stack:

```bash
docker compose up --build
```

Servicos e portas:

- frontend: http://localhost:3000
- backend: http://localhost:3333
- docs da API: http://localhost:3333/docs
- mailpit (UI): http://localhost:8025
- postgres: localhost:5432

Parar servicos:

```bash
docker compose down
```

## Execucao Local Sem Docker

### 1) Backend

```bash
cd api
npm install
cp .env.example .env
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Build de Producao

```bash
cd api
npm run build

cd ../frontend
npm run build
```

## Seed Inicial

Executar no backend:

```bash
cd api
npm run db:seed
```

Usuarios de desenvolvimento sao criados automaticamente pelo seed.

## Fluxo Funcional Esperado

1. Solicitante cria solicitacao em EM_ANALISE.
2. Aprovador aprova ou rejeita com justificativa.
3. Comprador registra compra para solicitacao aprovada.
4. Sistema atualiza centro de custo e pode gerar alerta de orcamento.
5. Solicitante recebe emails de atualizacao.
6. Todas as acoes relevantes entram em logs_auditoria.

## Seguranca Implementada

- validacao de dominio corporativo
- politica de senha forte
- rate limit de login
- bloqueio temporario por tentativas invalidas
- refresh token em cookie httpOnly
- logs de auditoria

## Relatorio Mensal

Um job agenda envio de resumo dos ultimos 30 dias para aprovadores no primeiro dia de cada mes.

## Dashboards

A API e a UI expoem:

- gastos por centro de custo
- gastos por departamento
- viagens por periodo
- ranking de solicitantes
- centros de custo proximos do limite

## Documentacao por Projeto

- Backend: veja api/README.md
- Frontend: veja frontend/README.md

## Licenca

Uso interno corporativo.
