-- ============================================
-- Migration: Candidate Matching - Per-candidate-per-job scoring
-- Stores skills, experience, and education match scores
-- ============================================

CREATE TABLE IF NOT EXISTS public.candidato_vaga_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidato_id UUID NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
  vaga_id UUID NOT NULL REFERENCES public.vagas(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  skills_match INTEGER NOT NULL DEFAULT 0 CHECK (skills_match >= 0 AND skills_match <= 100),
  experience_match INTEGER NOT NULL DEFAULT 0 CHECK (experience_match >= 0 AND experience_match <= 100),
  education_match INTEGER NOT NULL DEFAULT 0 CHECK (education_match >= 0 AND education_match <= 100),
  skills_encontradas TEXT[] DEFAULT ARRAY[]::TEXT[],
  skills_faltantes TEXT[] DEFAULT ARRAY[]::TEXT[],
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT candidato_vaga_scores_candidato_vaga_unique UNIQUE (candidato_id, vaga_id)
);

ALTER TABLE public.candidato_vaga_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_candidato_vaga_scores" ON public.candidato_vaga_scores;
CREATE POLICY "authenticated_all_candidato_vaga_scores" ON public.candidato_vaga_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_candidato_vaga_scores" ON public.candidato_vaga_scores;
CREATE POLICY "anon_select_candidato_vaga_scores" ON public.candidato_vaga_scores
  FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS cvs_tenant_idx ON public.candidato_vaga_scores(tenant_id);
CREATE INDEX IF NOT EXISTS cvs_candidato_idx ON public.candidato_vaga_scores(candidato_id);
CREATE INDEX IF NOT EXISTS cvs_vaga_idx ON public.candidato_vaga_scores(vaga_id);
CREATE INDEX IF NOT EXISTS cvs_score_idx ON public.candidato_vaga_scores(score DESC);

CREATE OR REPLACE FUNCTION public.update_cvs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "cvs_updated_at" ON public.candidato_vaga_scores;
CREATE TRIGGER "cvs_updated_at"
  BEFORE UPDATE ON public.candidato_vaga_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_cvs_updated_at();
