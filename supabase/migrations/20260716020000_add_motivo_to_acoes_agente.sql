DO $$
DECLARE
  col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'acoes_agente'
      AND column_name = 'motivo'
  ) INTO col_exists;

  RAISE NOTICE 'Diagnosis: column motivo exists on acoes_agente? %', col_exists;
END $$;

ALTER TABLE public.acoes_agente
  ADD COLUMN IF NOT EXISTS motivo TEXT;

COMMENT ON COLUMN public.acoes_agente.motivo IS 'Justificativa determinística da ação, escrita pelo planejador. Ex: "Sem contato desde 17/06 (28 dias), cadência 7 dias".';
