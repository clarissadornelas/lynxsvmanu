-- Add completion metadata columns to entrevistas table
ALTER TABLE public.entrevistas
  ADD COLUMN IF NOT EXISTS realizada_em TIMESTAMPTZ;

ALTER TABLE public.entrevistas
  ADD COLUMN IF NOT EXISTS realizada_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- Backfill realizada_em for interviews already completed (status in analisada/entregue/em_analise)
DO $$
BEGIN
  UPDATE public.entrevistas
  SET realizada_em = criado_em
  WHERE realizada_em IS NULL
    AND status IN ('analisada', 'entregue', 'em_analise', 'realizada')
    AND transcricao IS NOT NULL;
END $$;
