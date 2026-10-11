-- Cadastro opcional de clientes e espelho de pedido para envio pelo WhatsApp.
-- A plataforma registra intenção e reserva, mas não processa pagamentos.

ALTER TABLE usuario
  DROP CONSTRAINT IF EXISTS usuario_papel_check;
ALTER TABLE usuario
  ADD CONSTRAINT usuario_papel_check
  CHECK (papel IN ('EMPREENDEDOR', 'ADMIN', 'CLIENTE'));

CREATE TABLE IF NOT EXISTS cliente (
  usuario_id UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  telefone VARCHAR(20) NOT NULL CHECK (telefone ~ '^[0-9]{10,13}$'),
  endereco_entrega VARCHAR(300) NOT NULL,
  complemento VARCHAR(200),
  bairro VARCHAR(120),
  cidade VARCHAR(120),
  cep VARCHAR(12),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE contato_comercial
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS endereco_entrega VARCHAR(300),
  ADD COLUMN IF NOT EXISTS complemento_entrega VARCHAR(200),
  ADD COLUMN IF NOT EXISTS bairro_entrega VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cidade_entrega VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cep_entrega VARCHAR(12),
  ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(20),
  ADD COLUMN IF NOT EXISTS observacao_entrega VARCHAR(500),
  ADD CONSTRAINT contato_comercial_pagamento_check
    CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('PIX', 'DINHEIRO', 'CARTAO', 'COMBINAR')),
  ADD CONSTRAINT contato_comercial_telefone_cliente_check
    CHECK (cliente_telefone IS NULL OR cliente_telefone ~ '^[0-9]{10,13}$');

CREATE INDEX IF NOT EXISTS idx_contato_cliente_data
  ON contato_comercial (cliente_id, criado_em DESC)
  WHERE cliente_id IS NOT NULL;
