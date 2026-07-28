DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Insert seed user if not exists
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
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'clarissa@agencialit.com.br';
  END IF;

  -- Ensure only agent 01 is active for the user
  DELETE FROM public.acesso_agentes WHERE usuario_id = v_user_id AND agente_id IN ('02', '03');
  
  IF NOT EXISTS (SELECT 1 FROM public.acesso_agentes WHERE usuario_id = v_user_id AND agente_id = '01') THEN
    INSERT INTO public.acesso_agentes (usuario_id, agente_id, plano_contratado, valor_mensal, ativo)
    VALUES (v_user_id, '01', 'Assessor', 2490.00, true);
  ELSE
    UPDATE public.acesso_agentes SET ativo = true, plano_contratado = 'Assessor', valor_mensal = 2490.00 WHERE usuario_id = v_user_id AND agente_id = '01';
  END IF;

END $$;
