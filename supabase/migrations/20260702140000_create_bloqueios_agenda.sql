CREATE TABLE IF NOT EXISTS public.bloqueios_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agenda_id TEXT DEFAULT 'interna',
  titulo TEXT,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_bloqueios_agenda" ON public.bloqueios_agenda;
CREATE POLICY "authenticated_all_bloqueios_agenda" ON public.bloqueios_agenda
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_bloqueios_agenda" ON public.bloqueios_agenda;
CREATE POLICY "anon_select_bloqueios_agenda" ON public.bloqueios_agenda
  FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS bloqueios_agenda_tenant_idx ON public.bloqueios_agenda(tenant_id);
CREATE INDEX IF NOT EXISTS bloqueios_agenda_inicio_idx ON public.bloqueios_agenda(inicio);
