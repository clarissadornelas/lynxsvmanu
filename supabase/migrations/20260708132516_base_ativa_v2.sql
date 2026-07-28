-- ============================================
-- Migration: Base Ativa v2 - Relationship Context & Sentiment
-- ============================================

ALTER TABLE public.base_ativa
  ADD COLUMN IF NOT EXISTS contato_ate DATE;

ALTER TABLE public.base_ativa
  ADD COLUMN IF NOT EXISTS orientacao_agente TEXT;

ALTER TABLE public.base_ativa
  ADD COLUMN IF NOT EXISTS contexto_relacionamento TEXT;

ALTER TABLE public.base_ativa
  ADD COLUMN IF NOT EXISTS sentimento TEXT;

-- Add check constraint for sentimento values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'base_ativa_sentimento_check'
  ) THEN
    ALTER TABLE public.base_ativa
      ADD CONSTRAINT base_ativa_sentimento_check
      CHECK (sentimento IS NULL OR sentimento = ANY (ARRAY['positivo', 'neutro', 'atencao', 'risco']));
  END IF;
END $$;
