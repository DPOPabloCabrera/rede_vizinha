-- Permite que o empreendedor publique somente o perfil e os canais de contato.
ALTER TABLE vitrine
  ADD COLUMN IF NOT EXISTS perfil_apenas BOOLEAN NOT NULL DEFAULT FALSE;
