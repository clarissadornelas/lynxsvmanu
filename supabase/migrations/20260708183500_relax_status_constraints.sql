-- Relax any CHECK constraints on candidatos.status and vagas.status
-- to allow 'inativo' and 'arquivada' values

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'candidatos_status_check'
    AND conrelid = 'public.candidatos'::regclass
  ) THEN
    ALTER TABLE public.candidatos DROP CONSTRAINT candidatos_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vagas_status_check'
    AND conrelid = 'public.vagas'::regclass
  ) THEN
    ALTER TABLE public.vagas DROP CONSTRAINT vagas_status_check;
  END IF;
END $$;
