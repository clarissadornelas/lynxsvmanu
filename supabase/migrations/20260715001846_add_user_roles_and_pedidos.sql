-- ============================================
-- Migration: Add RBAC (papel) to usuarios & create pedidos table
-- ============================================

-- 1. Add 'papel' column to usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS papel TEXT NOT NULL DEFAULT 'usuario';

-- Add check constraint for papel (drop first for idempotency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_papel_check'
    AND conrelid = 'public.usuarios'::regclass
  ) THEN
    ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_papel_check;
  END IF;
END $$;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_papel_check
  CHECK (papel = ANY (ARRAY['admin'::text, 'usuario'::text]));

-- 2. Elevate specific users to admin role
UPDATE public.usuarios
SET papel = 'admin'
WHERE email IN ('clarissa@agencialit.com.br', 'michel.andre@gmail.com');

-- 3. Create pedidos table
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE NO ACTION,
  criado_por_email TEXT NOT NULL,
  agente_id TEXT NOT NULL,
  plano TEXT NOT NULL,
  valor_mensal NUMERIC(10,2),
  cupom TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add status check constraint (drop first for idempotency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_status_check'
    AND conrelid = 'public.pedidos'::regclass
  ) THEN
    ALTER TABLE public.pedidos DROP CONSTRAINT pedidos_status_check;
  END IF;
END $$;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_status_check
  CHECK (status = ANY (ARRAY['aguardando_pagamento'::text, 'pago'::text, 'cortesia'::text, 'cancelado'::text]));

-- 4. Enable RLS on pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for pedidos

-- Select: users can view their own records
DROP POLICY IF EXISTS "pedidos_select_own" ON public.pedidos;
CREATE POLICY "pedidos_select_own" ON public.pedidos
  FOR SELECT TO authenticated
  USING (criado_por_email = auth.jwt() ->> 'email');

-- Insert: users can insert their own records
DROP POLICY IF EXISTS "pedidos_insert_own" ON public.pedidos;
CREATE POLICY "pedidos_insert_own" ON public.pedidos
  FOR INSERT TO authenticated
  WITH CHECK (criado_por_email = auth.jwt() ->> 'email');

-- Update: only admins can update their own records
DROP POLICY IF EXISTS "pedidos_update_admin" ON public.pedidos;
CREATE POLICY "pedidos_update_admin" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (
    criado_por_email = auth.jwt() ->> 'email'
    AND EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.email = auth.jwt() ->> 'email'
      AND u.papel = 'admin'
    )
  )
  WITH CHECK (
    criado_por_email = auth.jwt() ->> 'email'
    AND EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.email = auth.jwt() ->> 'email'
      AND u.papel = 'admin'
    )
  );
