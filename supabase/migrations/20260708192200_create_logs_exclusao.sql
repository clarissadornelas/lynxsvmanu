CREATE TABLE IF NOT EXISTS public.logs_exclusao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('candidato', 'vaga')),
  registro_id UUID NOT NULL,
  registro_nome TEXT,
  executado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executado_por_email TEXT,
  contagens JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.logs_exclusao ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "authenticated_all_logs_exclusao" ON public.logs_exclusao;
  CREATE POLICY "authenticated_all_logs_exclusao" ON public.logs_exclusao
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "anon_select_logs_exclusao" ON public.logs_exclusao;
  CREATE POLICY "anon_select_logs_exclusao" ON public.logs_exclusao
    FOR SELECT TO anon USING (true);
END $$;

CREATE INDEX IF NOT EXISTS logs_exclusao_tenant_idx ON public.logs_exclusao(tenant_id);
CREATE INDEX IF NOT EXISTS logs_exclusao_criado_em_idx ON public.logs_exclusao(criado_em DESC);
CREATE INDEX IF NOT EXISTS logs_exclusao_tipo_idx ON public.logs_exclusao(tipo);
