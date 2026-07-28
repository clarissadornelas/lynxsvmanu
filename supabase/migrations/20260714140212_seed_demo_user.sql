DO $$
DECLARE
  v_demo_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'michel.andre+demo@gmail.com') THEN
    v_demo_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_demo_user_id,
      '00000000-0000-0000-0000-000000000000',
      'michel.andre+demo@gmail.com',
      crypt('lynxs-demo-2026', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Demonstração"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );
  END IF;

  INSERT INTO public.usuarios (tenant_id, nome, email, ativo)
  SELECT 'f854cf1b-46b2-477d-a18c-cc01caa68c2c', 'Demonstração',
         'michel.andre+demo@gmail.com', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE tenant_id = 'f854cf1b-46b2-477d-a18c-cc01caa68c2c'
      AND email = 'michel.andre+demo@gmail.com'
  );
END $$;
