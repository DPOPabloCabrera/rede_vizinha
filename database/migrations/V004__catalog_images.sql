-- Imagem de perfil do empreendedor e capa principal da vitrine.
ALTER TABLE empreendedor
  ADD COLUMN IF NOT EXISTS foto_url VARCHAR(2048);

ALTER TABLE vitrine
  ADD COLUMN IF NOT EXISTS imagem_url VARCHAR(2048);
