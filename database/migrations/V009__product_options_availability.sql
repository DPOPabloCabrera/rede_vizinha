-- Mantém produtos indisponíveis visíveis e permite variações de apresentação/preço
-- com estoque próprio (ex.: marmita individual e para dois).
ALTER TABLE produto
  ADD COLUMN IF NOT EXISTS disponivel BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS produto_opcao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
  nome VARCHAR(80) NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 80),
  preco NUMERIC(12, 2) CHECK (preco IS NULL OR preco >= 0),
  estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_opcao_produto
  ON produto_opcao (produto_id, criado_em);
CREATE UNIQUE INDEX IF NOT EXISTS idx_produto_opcao_nome_unico
  ON produto_opcao (produto_id, lower(nome));

ALTER TABLE contato_comercial_item
  ADD COLUMN IF NOT EXISTS opcao_id UUID REFERENCES produto_opcao(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opcao_nome VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_contato_item_opcao
  ON contato_comercial_item (opcao_id, contato_id);
