-- Esquema PostgreSQL da Rede Vizinha. Aplicado pelo backend/migrate.js em transação.
-- A tabela condominio é criada em V001__create_core_schema.sql.

CREATE TABLE IF NOT EXISTS usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id BIGINT NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  senha_hash TEXT NOT NULL,
  papel VARCHAR(20) NOT NULL DEFAULT 'EMPREENDEDOR'
    CHECK (papel IN ('EMPREENDEDOR', 'ADMIN')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_condominio_email
  ON usuario (condominio_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_usuario_condominio_papel
  ON usuario (condominio_id, papel, ativo);

CREATE TABLE IF NOT EXISTS empreendedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES usuario(id) ON DELETE CASCADE,
  telefone VARCHAR(20) NOT NULL CHECK (telefone ~ '^[0-9]{10,13}$'),
  unidade VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vitrine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendedor_id UUID NOT NULL REFERENCES empreendedor(id) ON DELETE CASCADE,
  nome VARCHAR(140) NOT NULL CHECK (char_length(trim(nome)) BETWEEN 2 AND 140),
  categoria VARCHAR(40) NOT NULL CHECK (categoria IN (
    'Gastronomia', 'Beleza e bem-estar', 'Casa e manutenção',
    'Aulas e atividades', 'Pets', 'Moda e acessórios', 'Outros serviços'
  )),
  descricao VARCHAR(700) NOT NULL CHECK (char_length(trim(descricao)) BETWEEN 10 AND 700),
  preco_destaque VARCHAR(80),
  whatsapp VARCHAR(20) NOT NULL CHECK (whatsapp ~ '^[0-9]{10,13}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'APROVADA', 'REJEITADA', 'PAUSADA')),
  moderado_por UUID REFERENCES usuario(id) ON DELETE SET NULL,
  moderado_em TIMESTAMPTZ,
  motivo_moderacao VARCHAR(500),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (motivo_moderacao IS NULL OR char_length(motivo_moderacao) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_vitrine_empreendedor_criado
  ON vitrine (empreendedor_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_vitrine_status_criado
  ON vitrine (status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_vitrine_moderador_data
  ON vitrine (moderado_por, moderado_em DESC);

CREATE TABLE IF NOT EXISTS produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vitrine_id UUID NOT NULL REFERENCES vitrine(id) ON DELETE CASCADE,
  nome VARCHAR(140) NOT NULL,
  descricao VARCHAR(700),
  preco NUMERIC(12, 2) CHECK (preco IS NULL OR preco >= 0),
  imagem_url VARCHAR(2048),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_vitrine_ativo
  ON produto (vitrine_id, ativo, criado_em DESC);

-- A aplicação padrão atende o condomínio Flex Osasco 2.
-- O endereço real não é inferido; pode ser atualizado pelo responsável do sistema.
INSERT INTO condominio (nome, endereco, codigo_convite, plano, ativo)
VALUES ('Flex Osasco 2', 'Endereço não informado', 'FLEX-OSASCO-2', 'FREE', TRUE)
ON CONFLICT (codigo_convite) DO NOTHING;
