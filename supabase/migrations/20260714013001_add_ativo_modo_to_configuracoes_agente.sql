CREATE TABLE IF NOT EXISTS public.configuracoes_agente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  agente_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  tipo_agente TEXT,
  criterios JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'real' CHECK (modo IN ('real', 'ensaio'));
