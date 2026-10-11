-- Mural público de pedidos e respostas de indicação do condomínio.
-- Menções só apontam para empreendedores com ao menos uma vitrine aprovada;
-- a API faz essa validação antes de gravar o relacionamento.

CREATE TABLE IF NOT EXISTS pedido_indicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id BIGINT NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
  autor_nome VARCHAR(120) NOT NULL CHECK (char_length(trim(autor_nome)) BETWEEN 2 AND 120),
  localizacao VARCHAR(100) NOT NULL DEFAULT '',
  categoria VARCHAR(80) NOT NULL CHECK (char_length(trim(categoria)) BETWEEN 2 AND 80),
  titulo VARCHAR(160) NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 8 AND 160),
  detalhes VARCHAR(1000) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'ENCERRADA')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (char_length(localizacao) <= 100),
  CHECK (char_length(detalhes) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_pedido_indicacao_condominio_data
  ON pedido_indicacao (condominio_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedido_indicacao_condominio_categoria_data
  ON pedido_indicacao (condominio_id, categoria, criado_em DESC);

CREATE TABLE IF NOT EXISTS pedido_indicacao_empreendedor (
  pedido_id UUID NOT NULL REFERENCES pedido_indicacao(id) ON DELETE CASCADE,
  empreendedor_id UUID NOT NULL REFERENCES empreendedor(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pedido_id, empreendedor_id)
);
CREATE INDEX IF NOT EXISTS idx_pedido_indicacao_empreendedor_alvo
  ON pedido_indicacao_empreendedor (empreendedor_id, pedido_id);

CREATE TABLE IF NOT EXISTS resposta_indicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedido_indicacao(id) ON DELETE CASCADE,
  autor_nome VARCHAR(120) NOT NULL CHECK (char_length(trim(autor_nome)) BETWEEN 2 AND 120),
  localizacao VARCHAR(100) NOT NULL DEFAULT '',
  texto VARCHAR(1000) NOT NULL CHECK (char_length(trim(texto)) BETWEEN 3 AND 1000),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (char_length(localizacao) <= 100)
);
CREATE INDEX IF NOT EXISTS idx_resposta_indicacao_pedido_data
  ON resposta_indicacao (pedido_id, criado_em ASC);
