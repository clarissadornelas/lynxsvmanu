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
