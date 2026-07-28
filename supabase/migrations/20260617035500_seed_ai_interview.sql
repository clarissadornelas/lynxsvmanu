DO $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_job1_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_job2_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
  v_cand1_id uuid := '55555555-5555-5555-5555-555555555555'::uuid;
  v_cand2_id uuid := '66666666-6666-6666-6666-666666666666'::uuid;
  v_cand3_id uuid := '77777777-7777-7777-7777-777777777777'::uuid;
BEGIN
  -- User seed
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'clarissa@agencialit.com.br') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'clarissa@agencialit.com.br', crypt('Skip@Pass', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Clarissa"}', 'authenticated', 'authenticated', '', '', '', '', '', '', '', '');
  END IF;

  -- Tenant seed
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'agencia-lit';
  IF v_tenant_id IS NULL THEN
    v_tenant_id := '11111111-1111-1111-1111-111111111111'::uuid;
    INSERT INTO public.tenants (id, slug, nome, headhunter_nome, headhunter_telefone)
    VALUES (v_tenant_id, 'agencia-lit', 'Agência Lit', 'Clarissa', '11999999999');
  END IF;

  -- Jobs seed
  INSERT INTO public.vagas (id, tenant_id, titulo, empresa, descricao, modelo_entrevista, status)
  VALUES 
    (v_job1_id, v_tenant_id, 'Desenvolvedor Frontend Sênior', 'TechCorp Brasil', 'React, TypeScript, 5+ anos experiência, boa comunicação.', 'individual', 'aberta'),
    (v_job2_id, v_tenant_id, 'Product Manager Pleno', 'Inova Startup', 'Agile, Jira, visão de produto, análise de dados.', 'individual', 'aberta')
  ON CONFLICT (id) DO NOTHING;

  -- Candidates seed
  INSERT INTO public.candidatos (id, tenant_id, vaga_id, nome, email, telefone, status, score, score_obs)
  VALUES 
    (v_cand1_id, v_tenant_id, v_job1_id, 'João Silva', 'joao.silva@example.com', '11999999999', 'novo', 91, 'Mais de 6 anos em React'),
    (v_cand2_id, v_tenant_id, v_job1_id, 'Maria Oliveira', 'maria.o@example.com', '11988888888', 'agendado', 83, 'Forte foco em design system'),
    (v_cand3_id, v_tenant_id, v_job1_id, 'Carlos Souza', 'carlos@example.com', '11977777777', 'novo', 75, 'Experiência generalista')
  ON CONFLICT (id) DO NOTHING;
END $$;
