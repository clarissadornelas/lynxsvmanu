DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracoes_agente'
      AND column_name = 'tipo_agente'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracoes_agente'
      AND column_name = 'agent_type'
  ) THEN
    ALTER TABLE public.configuracoes_agente RENAME COLUMN tipo_agente TO agent_type;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configuracoes_agente_tenant_id_agent_type_key'
      AND conrelid = 'public.configuracoes_agente'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_agente
      ADD CONSTRAINT configuracoes_agente_tenant_id_agent_type_key UNIQUE (tenant_id, agent_type);
  END IF;
END $$;
