CREATE TABLE IF NOT EXISTS public.agendas_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rotulo TEXT,
  ical_url TEXT,
  ultima_sincronizacao TIMESTAMPTZ,
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.eventos_agenda_externa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_externa_id UUID NOT NULL REFERENCES public.agendas_externas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  titulo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agendas_externas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_agenda_externa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_agendas_externas" ON public.agendas_externas;
CREATE POLICY "authenticated_all_agendas_externas" ON public.agendas_externas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_agendas_externas" ON public.agendas_externas;
CREATE POLICY "anon_select_agendas_externas" ON public.agendas_externas
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "authenticated_all_eventos_agenda_externa" ON public.eventos_agenda_externa;
CREATE POLICY "authenticated_all_eventos_agenda_externa" ON public.eventos_agenda_externa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_eventos_agenda_externa" ON public.eventos_agenda_externa;
CREATE POLICY "anon_select_eventos_agenda_externa" ON public.eventos_agenda_externa
  FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS agendas_externas_tenant_idx ON public.agendas_externas(tenant_id);
CREATE INDEX IF NOT EXISTS eventos_agenda_externa_agenda_idx ON public.eventos_agenda_externa(agenda_externa_id);
CREATE INDEX IF NOT EXISTS eventos_agenda_externa_inicio_idx ON public.eventos_agenda_externa(inicio);
