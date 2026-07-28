ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS dias_sem_resposta INTEGER CHECK (dias_sem_resposta IS NULL OR (dias_sem_resposta >= 1 AND dias_sem_resposta <= 60));

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS cadencia_follow_up_dias INTEGER CHECK (cadencia_follow_up_dias IS NULL OR (cadencia_follow_up_dias >= 1 AND cadencia_follow_up_dias <= 180));

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS criterios_cv TEXT CHECK (criterios_cv IS NULL OR char_length(criterios_cv) <= 600);

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS criterios_entrevista TEXT CHECK (criterios_entrevista IS NULL OR char_length(criterios_entrevista) <= 600);
