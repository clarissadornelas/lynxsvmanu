-- ============================================
-- Migration: Multi-tenant unique constraint, seed data, and acoes_agente RLS
-- ============================================

-- 1. Check for duplicates and add unique constraint on usuarios(tenant_id, email)
DO $$
DECLARE
  dup_count INTEGER;
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_tenant_email_unique'
      AND conrelid = 'public.usuarios'::regclass
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    SELECT COUNT(*) INTO dup_count
    FROM (
      SELECT tenant_id, email, COUNT(*) AS cnt
      FROM public.usuarios
      WHERE email IS NOT NULL AND tenant_id IS NOT NULL
      GROUP BY tenant_id, email
      HAVING COUNT(*) > 1
    ) dups;

    IF dup_count > 0 THEN
      RAISE NOTICE 'Found % duplicate (tenant_id, email) pairs in usuarios table. Removing duplicates keeping earliest criado_em.', dup_count;

      DELETE FROM public.usuarios u1
      WHERE u1.email IS NOT NULL
        AND u1.tenant_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.usuarios u2
          WHERE u2.tenant_id = u1.tenant_id
            AND u2.email = u1.email
            AND u2.criado_em < u1.criado_em
        );
    END IF;

    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_tenant_email_unique UNIQUE (tenant_id, email);
  END IF;
END $$;

-- 2. Seed data (idempotent) — link Clarissa to tenant f854cf1b-46b2-477d-a18c-cc01caa68c2c
INSERT INTO public.usuarios (tenant_id, nome, email, ativo)
SELECT
  'f854cf1b-46b2-477d-a18c-cc01caa68c2c'::uuid,
  'Clarissa',
  'clarissa@agencialit.com.br',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuarios
  WHERE tenant_id = 'f854cf1b-46b2-477d-a18c-cc01caa68c2c'::uuid
    AND email = 'clarissa@agencialit.com.br'
);

-- 3. RLS for acoes_agente — replace all existing policies with email-based pattern
ALTER TABLE public.acoes_agente ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "tenant_isolation_acoes_agente_select" ON public.acoes_agente;
DROP POLICY IF EXISTS "tenant_isolation_acoes_agente_insert" ON public.acoes_agente;
DROP POLICY IF EXISTS "tenant_isolation_acoes_agente_update" ON public.acoes_agente;
DROP POLICY IF EXISTS "tenant_isolation_acoes_agente_delete" ON public.acoes_agente;
DROP POLICY IF EXISTS "authenticated_all_acoes_agente" ON public.acoes_agente;

-- SELECT
CREATE POLICY "tenant_isolation_acoes_agente_select" ON public.acoes_agente
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  );

-- INSERT
CREATE POLICY "tenant_isolation_acoes_agente_insert" ON public.acoes_agente
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  );

-- UPDATE
CREATE POLICY "tenant_isolation_acoes_agente_update" ON public.acoes_agente
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

-- DELETE
CREATE POLICY "tenant_isolation_acoes_agente_delete" ON public.acoes_agente
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM public.usuarios u
      WHERE u.email = (auth.jwt() ->> 'email')
    )
  );
