CREATE TABLE IF NOT EXISTS public.configuracoes_agente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assessor', 'copiloto', 'base_ativa')),
  nome_agente TEXT,
  mensagem_apresentacao TEXT,
  tom TEXT NOT NULL DEFAULT 'profissional' CHECK (tom IN ('formal', 'profissional', 'casual')),
  tom_detalhe TEXT CHECK (char_length(tom_detalhe) <= 280),
  dias_sem_resposta INTEGER CHECK (dias_sem_resposta >= 1 AND dias_sem_resposta <= 60),
  cadencia_follow_up_dias INTEGER CHECK (cadencia_follow_up_dias >= 1 AND cadencia_follow_up_dias <= 180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT configuracoes_agente_tenant_agent_type_unique UNIQUE (tenant_id, agent_type)
);

ALTER TABLE public.configuracoes_agente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_configuracoes_agente_select" ON public.configuracoes_agente;
CREATE POLICY "tenant_isolation_configuracoes_agente_select" ON public.configuracoes_agente
  FOR SELECT TO authenticated
  USING (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  );

DROP POLICY IF EXISTS "tenant_isolation_configuracoes_agente_insert" ON public.configuracoes_agente;
CREATE POLICY "tenant_isolation_configuracoes_agente_insert" ON public.configuracoes_agente
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  );

DROP POLICY IF EXISTS "tenant_isolation_configuracoes_agente_update" ON public.configuracoes_agente;
CREATE POLICY "tenant_isolation_configuracoes_agente_update" ON public.configuracoes_agente
  FOR UPDATE TO authenticated
  USING (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  )
  WITH CHECK (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  );

CREATE INDEX IF NOT EXISTS configuracoes_agente_tenant_idx ON public.configuracoes_agente(tenant_id);
