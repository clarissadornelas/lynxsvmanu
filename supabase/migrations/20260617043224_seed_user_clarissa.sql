DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
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

    v_tenant_id := gen_random_uuid();
    INSERT INTO public.tenants (
      id, slug, nome, headhunter_nome, headhunter_telefone, janela_inicio, janela_fim
    ) VALUES (
      v_tenant_id,
      'agencia-lit-seed-new',
      'Agência LIT',
      'Clarissa',
      '11999999999',
      8,
      20
    ) ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;
