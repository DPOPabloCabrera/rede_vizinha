-- Esqueleto inicial. A DDL definitiva deve ser mantida aqui em versões incrementais.
CREATE TABLE IF NOT EXISTS condominio (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  codigo_convite VARCHAR(50) UNIQUE NOT NULL,
  plano VARCHAR(30) DEFAULT 'FREE',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
