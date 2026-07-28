CREATE TABLE IF NOT EXISTS public.acesso_agentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agente_id TEXT NOT NULL CHECK (agente_id IN ('01', '02', '03')),
    plano_contratado TEXT NOT NULL CHECK (plano_contratado IN ('Assessor', 'Copiloto', 'Base Ativa', 'Full')),
    data_contratacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ativo BOOLEAN NOT NULL DEFAULT true,
    data_cancelamento TIMESTAMPTZ,
    valor_mensal NUMERIC(10,2) NOT NULL
);

ALTER TABLE public.acesso_agentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_acesso_agentes" ON public.acesso_agentes;
CREATE POLICY "authenticated_all_acesso_agentes" ON public.acesso_agentes
  FOR ALL TO authenticated USING (true);

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'clarissa@agencialit.com.br' LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE usuario_id = v_user_id AND agente_id = '01') THEN
      INSERT INTO public.acesso_agentes (usuario_id, agente_id, plano_contratado, valor_mensal, ativo)
      VALUES (v_user_id, '01', 'Assessor', 2490.00, true);
    END IF;
  END IF;
END $$;
