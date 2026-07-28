-- Migration: Tenant-based agent hiring, queue deduplication, and unique index

-- 1. Add tenant_id column to acesso_agentes
ALTER TABLE public.acesso_agentes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- 2. Backfill tenant_id for existing records
UPDATE public.acesso_agentes
SET tenant_id = 'f854cf1b-46b2-477d-a18c-cc01caa68c2c'::uuid
WHERE tenant_id IS NULL;

-- 3. Create index on tenant_id for acesso_agentes
CREATE INDEX IF NOT EXISTS idx_acesso_agentes_tenant_id
  ON public.acesso_agentes(tenant_id);

-- 4. Seed all three agents for the default tenant (idempotent)
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid := 'f854cf1b-46b2-477d-a18c-cc01caa68c2c'::uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'clarissa@agencialit.com.br' LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE tenant_id = v_tenant_id AND agente_id = '01' AND ativo = true) THEN
      INSERT INTO public.acesso_agentes (tenant_id, usuario_id, agente_id, plano_contratado, valor_mensal, ativo)
      VALUES (v_tenant_id, v_user_id, '01', 'Assessor', 2490.00, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE tenant_id = v_tenant_id AND agente_id = '02' AND ativo = true) THEN
      INSERT INTO public.acesso_agentes (tenant_id, usuario_id, agente_id, plano_contratado, valor_mensal, ativo)
      VALUES (v_tenant_id, v_user_id, '02', 'Copiloto', 2990.00, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE tenant_id = v_tenant_id AND agente_id = '03' AND ativo = true) THEN
      INSERT INTO public.acesso_agentes (tenant_id, usuario_id, agente_id, plano_contratado, valor_mensal, ativo)
      VALUES (v_tenant_id, v_user_id, '03', 'Base Ativa', 1990.00, true);
    END IF;
  END IF;
END $$;

-- 5. Clean up duplicate pending actions in acoes_agente
-- Keep the oldest record per (tenant_id, agent_type, tipo_acao, candidato_id)
-- and cancel the rest
UPDATE public.acoes_agente
SET status = 'cancelada', resultado = 'duplicata'
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, agent_type, tipo_acao, candidato_id
        ORDER BY criado_em ASC, id ASC
      ) AS rn
    FROM public.acoes_agente
    WHERE status IN ('pendente', 'executando', 'aguardando_humano')
      AND candidato_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 6. Create partial unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS acoes_agente_dedupe_pendentes
  ON public.acoes_agente(tenant_id, agent_type, tipo_acao, candidato_id)
  WHERE status IN ('pendente', 'executando', 'aguardando_humano');
