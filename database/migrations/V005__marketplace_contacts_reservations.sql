-- Contatos públicos, estoque físico e reservas temporárias do marketplace indireto.
ALTER TABLE empreendedor
  ALTER COLUMN telefone DROP NOT NULL,
  ALTER COLUMN unidade DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS empreendedor_telefone_check,
  ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS site_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
  ADD CONSTRAINT empreendedor_telefone_check CHECK (telefone IS NULL OR telefone ~ '^[0-9]{10,13}$');

ALTER TABLE vitrine
  ALTER COLUMN whatsapp DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS vitrine_whatsapp_check,
  ADD CONSTRAINT vitrine_whatsapp_check CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{10,13}$');

ALTER TABLE produto
  ADD COLUMN IF NOT EXISTS estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0);

CREATE TABLE IF NOT EXISTS contato_comercial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vitrine_id UUID NOT NULL REFERENCES vitrine(id) ON DELETE CASCADE,
  canal VARCHAR(20) NOT NULL CHECK (canal IN ('WHATSAPP', 'INSTAGRAM', 'SITE', 'LINKEDIN')),
  status VARCHAR(20) NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'VENDIDO', 'ENCERRADO', 'EXPIRADO')),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contato_vitrine_data
  ON contato_comercial (vitrine_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contato_aberto_expira
  ON contato_comercial (expira_em) WHERE status = 'ABERTO';

CREATE TABLE IF NOT EXISTS contato_comercial_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id UUID NOT NULL REFERENCES contato_comercial(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produto(id) ON DELETE SET NULL,
  nome_produto VARCHAR(140) NOT NULL,
  preco_unitario NUMERIC(12, 2) CHECK (preco_unitario IS NULL OR preco_unitario >= 0),
  quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 999),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contato_item_produto
  ON contato_comercial_item (produto_id, contato_id);
