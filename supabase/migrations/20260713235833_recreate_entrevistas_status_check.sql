DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entrevistas_status_check'
    AND conrelid = 'public.entrevistas'::regclass
  ) THEN
    ALTER TABLE public.entrevistas DROP CONSTRAINT entrevistas_status_check;
  END IF;
END $$;

ALTER TABLE public.entrevistas
  ADD CONSTRAINT entrevistas_status_check
  CHECK (status = ANY (ARRAY['aguardando'::text, 'roteiro_pronto'::text, 'em_andamento'::text, 'realizada'::text, 'em_analise'::text, 'analisada'::text, 'concluida'::text, 'entregue'::text, 'cancelada'::text]));
