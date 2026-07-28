-- ============================================
-- Migration: Create usuarios table & extend agenda tables
-- ============================================

-- 1. Create usuarios table
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- RLS Policies (following project patterns)
DROP POLICY IF EXISTS "authenticated_all_usuarios" ON public.usuarios;
CREATE POLICY "authenticated_all_usuarios" ON public.usuarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_usuarios" ON public.usuarios;
CREATE POLICY "anon_select_usuarios" ON public.usuarios
  FOR SELECT TO anon USING (true);

-- Index on tenant_id
CREATE INDEX IF NOT EXISTS usuarios_tenant_idx ON public.usuarios(tenant_id);

-- 2. Extend bloqueios_agenda with usuario_id
ALTER TABLE public.bloqueios_agenda
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- 3. Extend agendas_externas with usuario_id
ALTER TABLE public.agendas_externas
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
