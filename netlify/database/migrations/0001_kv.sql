-- Armazenamento chave/valor das configurações do painel admin
-- (preços de destaque, promoção, cupom e FAQs).
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
