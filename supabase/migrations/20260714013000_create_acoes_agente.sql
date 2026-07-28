CREATE TABLE IF NOT EXISTS public.acoes_agente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assessor', 'copiloto', 'base_ativa')),
  tipo_acao TEXT NOT NULL CHECK (tipo_acao IN ('follow_up_base', 'cobranca_sem_resposta', 'lembrete_roteiro', 'notificar_operador', 'responder_candidato')),
  candidato_id UUID REFERENCES public.candidatos(id) ON DELETE SET NULL,
  vaga_id UUID REFERENCES public.vagas(id) ON DELETE SET NULL,
  agendada_para TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'executando', 'concluida', 'simulada', 'falhou', 'aguardando_humano', 'cancelada')),
  texto_composto TEXT,
  motivo_escalacao TEXT,
  resultado TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  executada_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acoes_agente_pendentes ON public.acoes_agente(tenant_id, status, agendada_para);

ALTER TABLE public.acoes_agente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_acoes_agente_select" ON public.acoes_agente;
CREATE POLICY "tenant_isolation_acoes_agente_select" ON public.acoes_agente
  FOR SELECT TO authenticated
  USING (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  );

DROP POLICY IF EXISTS "tenant_isolation_acoes_agente_insert" ON public.acoes_agente;
CREATE POLICY "tenant_isolation_acoes_agente_insert" ON public.acoes_agente
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  );

DROP POLICY IF EXISTS "tenant_isolation_acoes_agente_update" ON public.acoes_agente;
CREATE POLICY "tenant_isolation_acoes_agente_update" ON public.acoes_agente
  FOR UPDATE TO authenticated
  USING (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  )
  WITH CHECK (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  );
