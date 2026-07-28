-- ============================================
-- Migration: Normalize tenant slug and create chamados table
-- ============================================

-- 1. Data Migration - Tenant Update (idempotent)
-- Update slug from 'maisa' to 'mbm-rh' for tenant f854cf1b-46b2-477d-a18c-cc01caa68c2c
UPDATE public.tenants
SET slug = 'mbm-rh'
WHERE id = 'f854cf1b-46b2-477d-a18c-cc01caa68c2c'::uuid
  AND slug = 'maisa';

-- 2. Create chamados table
CREATE TABLE IF NOT EXISTS public.chamados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  criado_por_email TEXT NOT NULL,
  assunto TEXT NOT NULL CHECK (char_length(assunto) <= 120),
  categoria TEXT NOT NULL DEFAULT 'duvida' CHECK (categoria IN ('duvida', 'problema', 'sugestao', 'financeiro')),
  mensagem TEXT NOT NULL CHECK (char_length(mensagem) <= 2000),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  resposta TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (idempotent)

-- SELECT: Allow authenticated users to view their own tickets
DROP POLICY IF EXISTS "chamados_select_own" ON public.chamados;
CREATE POLICY "chamados_select_own" ON public.chamados
  FOR SELECT TO authenticated
  USING (
    criado_por_email = (auth.jwt() ->> 'email')
  );

-- INSERT: Allow authenticated users to insert tickets with their own email
DROP POLICY IF EXISTS "chamados_insert_own" ON public.chamados;
CREATE POLICY "chamados_insert_own" ON public.chamados
  FOR INSERT TO authenticated
  WITH CHECK (
    criado_por_email = (auth.jwt() ->> 'email')
  );

-- 5. Index for email-based lookups
CREATE INDEX IF NOT EXISTS chamados_criado_por_email_idx ON public.chamados(criado_por_email);
CREATE INDEX IF NOT EXISTS chamados_tenant_idx ON public.chamados(tenant_id);

-- 6. Trigger to auto-update atualizado_em on row changes
CREATE OR REPLACE FUNCTION public.handle_chamados_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "chamados_updated_at" ON public.chamados;
CREATE TRIGGER "chamados_updated_at"
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.handle_chamados_updated_at();
