DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  default_tenant_id uuid;
BEGIN
  -- Seed user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'clarissa@agencialit.com.br') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      new_user_id,
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

  -- Create default tenant and entitlements
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = 'agencia-lit') THEN
    default_tenant_id := gen_random_uuid();
    INSERT INTO public.tenants (id, slug, nome, headhunter_nome, headhunter_telefone, ativo)
    VALUES (default_tenant_id, 'agencia-lit', 'Agência Lit', 'Clarissa', '11999999999', true);

    INSERT INTO public.entitlements (tenant_id, ag1_assessor, ag2_copiloto, ag3_ativador)
    VALUES (default_tenant_id, true, true, true);
  END IF;
END $$;

-- Fix RLS by adding permissive policies for authenticated users
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['agendamentos', 'base_ativa', 'candidatos', 'conversas', 'disparos', 'entitlements', 'entrevistas', 'jobs', 'mensagens', 'tenants', 'usage_events', 'vagas']) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_all_' || t || '" ON public.' || t;
    EXECUTE 'CREATE POLICY "authenticated_all_' || t || '" ON public.' || t || ' FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END LOOP;
END $$;
