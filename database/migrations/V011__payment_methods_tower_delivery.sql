-- Formas de pagamento aceitas por vitrine e entrega por Torre / Apto / Flex (1 ou 2).

ALTER TABLE vitrine
  ADD COLUMN IF NOT EXISTS formas_pagamento TEXT[] NOT NULL DEFAULT ARRAY['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'];

ALTER TABLE vitrine DROP CONSTRAINT IF EXISTS vitrine_formas_pagamento_check;
ALTER TABLE vitrine
  ADD CONSTRAINT vitrine_formas_pagamento_check
  CHECK (cardinality(formas_pagamento) >= 1 AND formas_pagamento <@ ARRAY['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO']);

ALTER TABLE contato_comercial DROP CONSTRAINT IF EXISTS contato_comercial_pagamento_check;
ALTER TABLE contato_comercial
  ADD CONSTRAINT contato_comercial_pagamento_check
  CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('PIX', 'DINHEIRO', 'CREDITO', 'DEBITO', 'CARTAO', 'COMBINAR'));

ALTER TABLE contato_comercial
  ADD COLUMN IF NOT EXISTS torre_entrega VARCHAR(20),
  ADD COLUMN IF NOT EXISTS apto_entrega VARCHAR(10),
  ADD COLUMN IF NOT EXISTS flex_entrega VARCHAR(10);

ALTER TABLE contato_comercial DROP CONSTRAINT IF EXISTS contato_comercial_flex_check;
ALTER TABLE contato_comercial
  ADD CONSTRAINT contato_comercial_flex_check
  CHECK (flex_entrega IS NULL OR flex_entrega IN ('FLEX_1', 'FLEX_2'));

ALTER TABLE cliente
  ADD COLUMN IF NOT EXISTS torre VARCHAR(20),
  ADD COLUMN IF NOT EXISTS apto VARCHAR(10),
  ADD COLUMN IF NOT EXISTS flex VARCHAR(10);
