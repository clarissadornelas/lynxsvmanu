DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check user and get ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'clarissa@agencialit.com.br' LIMIT 1;

  -- Insert seed user if not exists
  IF v_user_id IS NULL THEN
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

  -- Ensure tokens are empty strings instead of null, and phone is NULL if empty
  UPDATE auth.users
  SET 
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, ''),
      phone = NULLIF(phone, '')
  WHERE id = v_user_id;

  -- Insert access to agents
  IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE usuario_id = v_user_id AND agente_id = '01') THEN
    INSERT INTO public.acesso_agentes (usuario_id, agente_id, plano_contratado, ativo, valor_mensal)
    VALUES (v_user_id, '01', 'Assessor', true, 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE usuario_id = v_user_id AND agente_id = '02') THEN
    INSERT INTO public.acesso_agentes (usuario_id, agente_id, plano_contratado, ativo, valor_mensal)
    VALUES (v_user_id, '02', 'Copiloto', true, 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE usuario_id = v_user_id AND agente_id = '03') THEN
    INSERT INTO public.acesso_agentes (usuario_id, agente_id, plano_contratado, ativo, valor_mensal)
    VALUES (v_user_id, '03', 'Base Ativa', true, 0);
  END IF;
  
  -- Update if exists but inactive
  UPDATE public.acesso_agentes SET ativo = true, valor_mensal = 0
  WHERE usuario_id = v_user_id AND agente_id IN ('01', '02', '03');

END $$;
