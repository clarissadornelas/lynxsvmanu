-- ============================================
-- Migration: Add adiado_ate (snooze) column to base_ativa
-- ============================================

-- 1. Read-only diagnosis: log current columns on base_ativa
DO $$
DECLARE
  col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'base_ativa'
      AND column_name = 'adiado_ate'
  ) INTO col_exists;

  RAISE NOTICE 'Diagnosis: column adiado_ate exists on base_ativa? %', col_exists;
END $$;

-- 2. Add adiado_ate column if it does not exist (idempotent)
ALTER TABLE public.base_ativa
  ADD COLUMN IF NOT EXISTS adiado_ate DATE;

-- 3. Ensure auth seed user (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'clarissa@agencialit.com.br') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'clarissa@agencialit.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Clarissa"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );
  END IF;
END $$;

-- 4. RLS check: ensure authenticated policies cover base_ativa (recreate to be safe)
DROP POLICY IF EXISTS "authenticated_all_base_ativa" ON public.base_ativa;
CREATE POLICY "authenticated_all_base_ativa" ON public.base_ativa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
