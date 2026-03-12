# Frontend - Sistema de Viagens Corporativas

Aplicacao web em Next.js responsavel por autenticacao, operacao de solicitacoes e visualizacao de indicadores.

## Tecnologias

- Next.js 16
- React 19
- Shadcn UI
- Tailwind CSS

## Rotas Principais

- /login
- /reset-password
- /dashboard
- /solicitacoes
- /aprovacoes
- /compras
- /admin/users

## Estrutura

```
src
├── app
│   ├── login
│   ├── reset-password
│   ├── dashboard
│   ├── solicitacoes
│   ├── aprovacoes
│   ├── compras
│   └── admin/users
├── components
│   ├── layout
│   └── ui
└── lib
	├── api.ts
	└── session.ts
```

## Variaveis de Ambiente

Use .env.example como base.

```bash
NEXT_PUBLIC_API_URL=http://localhost:3333
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
```

## Fluxo de Acesso

1. Login em /login.
2. API retorna access token e refresh cookie.
3. Frontend guarda access token e user na sessao local.
4. Em 401, o client tenta refresh automaticamente.
5. Se refresh falhar, remove sessao e redireciona para login.

## Fluxos por Papel

Solicitante:

- cria solicitacao
- visualiza apenas as proprias solicitacoes
- cancela solicitacao quando permitido

Aprovador:

- visualiza solicitacoes em analise
- aprova ou rejeita com justificativa

Comprador:

- visualiza solicitacoes aprovadas
- registra compra

Administrador:

- visualiza dashboards
- cadastra usuarios
- acessa visao ampla de operacao

## Build e Prerender

Cuidados adotados:

- uso de APIs do browser somente no client
- tela de reset com Suspense para compatibilidade com Next 16
- leitura de sessao local somente em efeitos client-side

## Checklist de Teste Manual

1. Login com usuario valido.
2. Solicitar reset de senha e concluir troca.
3. Criar solicitacao como solicitante.
4. Aprovar/rejeitar como aprovador.
5. Registrar compra como comprador.
6. Validar dashboard e mensagens de erro.

## Troubleshooting

- Erro de API: conferir NEXT_PUBLIC_API_URL.
- Tela sem sessao: limpar localStorage e logar novamente.
- 401 recorrente: verificar endpoint /auth/refresh no backend.
- Build falha em prerender: revisar uso de localStorage, window e useSearchParams.
