-- Add new CRM columns to base_ativa
ALTER TABLE public.base_ativa
ADD COLUMN IF NOT EXISTS nicho TEXT,
ADD COLUMN IF NOT EXISTS mercado TEXT,
ADD COLUMN IF NOT EXISTS nivel TEXT,
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create trigger for automated status lifecycle changes
CREATE OR REPLACE FUNCTION public.set_contratado_em()
RETURNS trigger AS $function$
BEGIN
  IF NEW.status = 'contratado' AND OLD.status IS DISTINCT FROM 'contratado' THEN
    NEW.contratado_em = now();
  END IF;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_candidato_contratado ON public.candidatos;
CREATE TRIGGER on_candidato_contratado
  BEFORE UPDATE ON public.candidatos
  FOR EACH ROW EXECUTE FUNCTION public.set_contratado_em();

-- Seed Test User and Sample Data
DO $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  -- Insert user idempotently
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

  -- Verify tenant exists
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'agencia-lit' LIMIT 1;
  
  IF v_tenant_id IS NOT NULL THEN
    -- Seed candidates for onboarding checks
    IF NOT EXISTS (SELECT 1 FROM public.candidatos WHERE email = 'hired30@test.com') THEN
      INSERT INTO public.candidatos (id, tenant_id, nome, email, telefone, status, contratado_em, origem)
      VALUES (gen_random_uuid(), v_tenant_id, 'Hired 30 Days', 'hired30@test.com', '11999999901', 'contratado', NOW() - INTERVAL '30 days', 'csv');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.candidatos WHERE email = 'rejected@test.com') THEN
      INSERT INTO public.candidatos (id, tenant_id, nome, email, telefone, status, origem)
      VALUES (gen_random_uuid(), v_tenant_id, 'Rejected Candidate', 'rejected@test.com', '11999999902', 'reprovado', 'csv');
    END IF;

    -- Seed base ativa
    IF NOT EXISTS (SELECT 1 FROM public.base_ativa WHERE telefone = '11999999903') THEN
      INSERT INTO public.base_ativa (id, tenant_id, nome, telefone, email, nicho, mercado, nivel, categoria, cadencia_dias, ultimo_ping_em, status_profissional, abertura, origem)
      VALUES (gen_random_uuid(), v_tenant_id, 'Talent Pool User', '11999999903', 'talent@test.com', 'Tecnologia', 'Financeiro', 'Especialista', 'Frontend', 30, NOW() - INTERVAL '31 days', 'empregado', 'aberto', 'csv');
    END IF;
  END IF;
END $$;
