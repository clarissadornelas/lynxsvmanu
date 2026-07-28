-- Migration: Fix RLS policies for configuracoes_agente
-- Replaces broken JWT-claims-based policies with email-based tenant isolation
-- via the usuarios table, enabling upsert (INSERT ... ON CONFLICT DO UPDATE)

-- Seed usuarios record for existing user if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.email = 'clarissa@agencialit.com.br'
  ) THEN
    INSERT INTO public.usuarios (tenant_id, nome, email, ativo)
    SELECT t.id, 'Clarissa', 'clarissa@agencialit.com.br', true
    FROM public.tenants t
    WHERE t.slug = 'agencia-lit'
    LIMIT 1;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.configuracoes_agente ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (idempotent)
DROP POLICY IF EXISTS "tenant_isolation_configuracoes_agente_select" ON public.configuracoes_agente;
DROP POLICY IF EXISTS "tenant_isolation_configuracoes_agente_insert" ON public.configuracoes_agente;
DROP POLICY IF EXISTS "tenant_isolation_configuracoes_agente_update" ON public.configuracoes_agente;
DROP POLICY IF EXISTS "tenant_isolation_configuracoes_agente_delete" ON public.configuracoes_agente;
DROP POLICY IF EXISTS "authenticated_all_configuracoes_agente" ON public.configuracoes_agente;

-- SELECT: allow reading rows where tenant_id matches the user's tenant
CREATE POLICY "tenant_isolation_configuracoes_agente_select" ON public.configuracoes_agente
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  );

-- INSERT: allow inserting rows where tenant_id matches the user's tenant
-- (also validates the WITH CHECK for upsert ON CONFLICT DO UPDATE)
CREATE POLICY "tenant_isolation_configuracoes_agente_insert" ON public.configuracoes_agente
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  );

-- UPDATE: allow updating rows where tenant_id matches the user's tenant
-- (required for the UPDATE phase of upsert ON CONFLICT DO UPDATE)
CREATE POLICY "tenant_isolation_configuracoes_agente_update" ON public.configuracoes_agente
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  );

-- DELETE: allow deleting rows where tenant_id matches the user's tenant
CREATE POLICY "tenant_isolation_configuracoes_agente_delete" ON public.configuracoes_agente
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  );
