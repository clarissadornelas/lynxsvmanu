-- Migration: Add missing columns and unique constraint to configuracoes_agente
-- Resolves PGRST204 error when upserting agent configurations

-- 1. Add missing columns (idempotent)
ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS nome_agente TEXT;

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS mensagem_apresentacao TEXT;

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS tom TEXT DEFAULT 'profissional';

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS tom_detalhe TEXT;

-- 2. Backfill tom for existing rows that have NULL
UPDATE public.configuracoes_agente
SET tom = 'profissional'
WHERE tom IS NULL;

-- 3. Ensure unique constraint on (tenant_id, agent_type) for upsert onConflict support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configuracoes_agente_tenant_agent_type_unique'
      AND conrelid = 'public.configuracoes_agente'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_agente
      ADD CONSTRAINT configuracoes_agente_tenant_agent_type_unique UNIQUE (tenant_id, agent_type);
  END IF;
END $$;

-- 4. Create index for the unique constraint if not exists (belt and suspenders)
CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_agente_tenant_id_agent_type_key
  ON public.configuracoes_agente (tenant_id, agent_type)
  WHERE tenant_id IS NOT NULL AND agent_type IS NOT NULL;
