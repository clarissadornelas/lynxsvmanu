-- 1. Add agentes column to vagas table
ALTER TABLE public.vagas
ADD COLUMN IF NOT EXISTS agentes text[] NOT NULL DEFAULT ARRAY['assessor']::text[];

-- 2. Create candidato_eventos table
CREATE TABLE IF NOT EXISTS public.candidato_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
  vaga_id UUID REFERENCES public.vagas(id) ON DELETE SET NULL,
  tenant_id UUID,
  tipo TEXT,
  de TEXT,
  para TEXT,
  agente TEXT,
  ator TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS candidato_eventos_candidato_id_idx
  ON public.candidato_eventos (candidato_id);

CREATE INDEX IF NOT EXISTS candidato_eventos_vaga_id_idx
  ON public.candidato_eventos (vaga_id);

-- 4. Enable RLS
ALTER TABLE public.candidato_eventos ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies mirroring candidatos table
DROP POLICY IF EXISTS "authenticated_all_candidato_eventos" ON public.candidato_eventos;
CREATE POLICY "authenticated_all_candidato_eventos" ON public.candidato_eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_candidato_eventos" ON public.candidato_eventos;
CREATE POLICY "anon_select_candidato_eventos" ON public.candidato_eventos
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_candidato_eventos" ON public.candidato_eventos;
CREATE POLICY "anon_update_candidato_eventos" ON public.candidato_eventos
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 6. Verification queries
DO $$
DECLARE
  total_vagas INTEGER;
  vagas_com_assessor INTEGER;
  total_eventos INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_vagas FROM public.vagas;
  SELECT COUNT(*) INTO vagas_com_assessor FROM public.vagas WHERE 'assessor' = ANY(agentes);
  SELECT COUNT(*) INTO total_eventos FROM public.candidato_eventos;

  RAISE NOTICE 'Verification: total vagas = %, vagas with assessor = %, candidato_eventos count = %',
    total_vagas, vagas_com_assessor, total_eventos;
END $$;
