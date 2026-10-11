-- Empreendedores cadastrados são mencionados ao compartilhar uma indicação,
-- vinculados à resposta da comunidade e não ao pedido de recomendações.
CREATE TABLE IF NOT EXISTS resposta_indicacao_empreendedor (
  resposta_id UUID NOT NULL REFERENCES resposta_indicacao(id) ON DELETE CASCADE,
  empreendedor_id UUID NOT NULL REFERENCES empreendedor(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (resposta_id, empreendedor_id)
);

CREATE INDEX IF NOT EXISTS idx_resposta_indicacao_empreendedor_alvo
  ON resposta_indicacao_empreendedor (empreendedor_id, resposta_id);
