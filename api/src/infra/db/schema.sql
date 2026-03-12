CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  cargo VARCHAR(120),
  departamento VARCHAR(120),
  role VARCHAR(20) NOT NULL CHECK (role IN ('SOLICITANTE', 'APROVADOR', 'COMPRADOR', 'ADMINISTRADOR')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  ultimo_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email::text LIKE '%@solucoesterceirizadas.com.br')
);

CREATE TABLE IF NOT EXISTS centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL,
  departamento VARCHAR(120) NOT NULL,
  orcamento_anual NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_utilizado NUMERIC(14,2) NOT NULL DEFAULT 0,
  ano_referencia INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (codigo, ano_referencia)
);

CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id UUID NOT NULL REFERENCES usuarios(id),
  centro_custo_id UUID NOT NULL REFERENCES centros_custo(id),
  origem VARCHAR(200) NOT NULL,
  destino VARCHAR(200) NOT NULL,
  data_partida DATE NOT NULL,
  data_retorno DATE NOT NULL,
  precisa_bagagem BOOLEAN NOT NULL DEFAULT FALSE,
  precisa_hotel BOOLEAN NOT NULL DEFAULT FALSE,
  precisa_carro BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_viagem TEXT NOT NULL,
  observacoes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'EM_ANALISE' CHECK (status IN ('EM_ANALISE', 'APROVADO', 'REJEITADO', 'COMPRADO')),
  justificativa_rejeicao TEXT,
  aprovado_por UUID REFERENCES usuarios(id),
  aprovado_at TIMESTAMPTZ,
  cancelado BOOLEAN NOT NULL DEFAULT FALSE,
  cancelado_por UUID REFERENCES usuarios(id),
  cancelado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (data_retorno >= data_partida)
);

CREATE TABLE IF NOT EXISTS compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES solicitacoes(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PASSAGEM', 'HOTEL', 'CARRO')),
  codigo_reserva VARCHAR(120) NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  criado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs_auditoria (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  acao VARCHAR(30) NOT NULL,
  entidade VARCHAR(80) NOT NULL,
  entidade_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip INET,
  user_agent TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens_magic_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  token_hash TEXT NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  ip_solicitacao INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  refresh_token_hash TEXT NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  revogado_em TIMESTAMPTZ,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(80) NOT NULL,
  destinatario TEXT NOT NULL,
  assunto TEXT NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
  tentativas INT NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erro_ultimo_envio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alertas_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id UUID NOT NULL REFERENCES centros_custo(id),
  percentual_utilizado NUMERIC(5,2) NOT NULL,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_solicitante ON solicitacoes (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes (status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_at ON solicitacoes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compras_solicitacao ON compras (solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_compras_created_at ON compras (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs_auditoria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_entidade ON logs_auditoria (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_emails (status, proxima_tentativa_em);
