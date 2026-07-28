-- 1. Update candidatos status check constraint
ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_status_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_status_check CHECK (
  status = ANY (ARRAY[
    'novo', 'shortlist', 'contatado', 'agendado', 'entrevistado',
    'aprovado', 'reprovado', 'contratado', 'descartado',
    'Entrevistado - Aprovado', 'Entrevistado - Reprovado', 'Entrevistado - Em Análise',
    'em_teste'
  ])
);

-- 2. Add extra columns for candidate specific fields if without vacancy
ALTER TABLE public.candidatos
ADD COLUMN IF NOT EXISTS cargo text,
ADD COLUMN IF NOT EXISTS empresa text;

-- 3. Create follow_ups table
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dia_follow_up INTEGER NOT NULL CHECK (dia_follow_up IN (30, 60, 90)),
  data_agendada DATE NOT NULL,
  data_enviado TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'respondido')),
  mensagem_enviada TEXT,
  resposta_candidato TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Set RLS
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_follow_ups" ON public.follow_ups;
CREATE POLICY "authenticated_all_follow_ups" ON public.follow_ups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Trigger to generate follow ups automatically
CREATE OR REPLACE FUNCTION public.generate_follow_ups()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'em_teste' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'em_teste') THEN
      -- 30 days
      INSERT INTO public.follow_ups (candidato_id, tenant_id, dia_follow_up, data_agendada)
      VALUES (NEW.id, NEW.tenant_id, 30, (COALESCE(NEW.contratado_em, now()) + interval '30 days')::DATE)
      ON CONFLICT DO NOTHING;

      -- 60 days
      INSERT INTO public.follow_ups (candidato_id, tenant_id, dia_follow_up, data_agendada)
      VALUES (NEW.id, NEW.tenant_id, 60, (COALESCE(NEW.contratado_em, now()) + interval '60 days')::DATE)
      ON CONFLICT DO NOTHING;

      -- 90 days
      INSERT INTO public.follow_ups (candidato_id, tenant_id, dia_follow_up, data_agendada)
      VALUES (NEW.id, NEW.tenant_id, 90, (COALESCE(NEW.contratado_em, now()) + interval '90 days')::DATE)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_candidato_em_teste ON public.candidatos;
CREATE TRIGGER on_candidato_em_teste
  AFTER INSERT OR UPDATE ON public.candidatos
  FOR EACH ROW EXECUTE FUNCTION public.generate_follow_ups();

-- 6. Seed data
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_cand_id uuid;
BEGIN
  -- Insert user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'clarissa@agencialit.com.br') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'clarissa@agencialit.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Clarissa"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '', NULL, '', '', ''
    );
  END IF;

  -- Ensure tenant exists
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'agencia-lit' LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    -- Seed candidates for testing (trigger will automatically create follow ups)
    IF NOT EXISTS (SELECT 1 FROM public.candidatos WHERE email = 'teste30@example.com') THEN
      v_cand_id := gen_random_uuid();
      INSERT INTO public.candidatos (id, tenant_id, nome, email, telefone, status, origem, contratado_em, cargo, empresa)
      VALUES (v_cand_id, v_tenant_id, 'Lucas Integrado', 'teste30@example.com', '11999999992', 'em_teste', 'manual', NOW() - INTERVAL '35 days', 'Desenvolvedor Backend', 'Tech Corp');
      
      -- Let's make sure the 30-day follow up is shown as pending/late for this candidate
      -- We don't need to manually create follow ups since the trigger does it!
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.candidatos WHERE email = 'teste90@example.com') THEN
      v_cand_id := gen_random_uuid();
      INSERT INTO public.candidatos (id, tenant_id, nome, email, telefone, status, origem, contratado_em, cargo, empresa)
      VALUES (v_cand_id, v_tenant_id, 'Mariana Silva Teste', 'teste90@example.com', '11999999993', 'em_teste', 'manual', NOW() - INTERVAL '5 days', 'Product Manager', 'Inova Inc');
    END IF;
  END IF;
END $$;
