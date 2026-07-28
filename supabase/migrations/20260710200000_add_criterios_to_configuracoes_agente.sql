ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS criterios_cv text CHECK (char_length(criterios_cv) <= 600),
  ADD COLUMN IF NOT EXISTS criterios_entrevista text CHECK (char_length(criterios_entrevista) <= 600);
