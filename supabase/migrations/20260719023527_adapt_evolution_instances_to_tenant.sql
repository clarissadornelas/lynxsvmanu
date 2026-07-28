-- Migration: adota evolution_instances para o controle de migração e move a posse da instância para o tenant.
-- A tabela já existe no banco atual (criada fora de migração, 0 linhas); o CREATE IF NOT EXISTS
-- existe para instalação limpa, não recria nada aqui.

-- 1. Adoção: schema mínimo que o código usa, para instalação limpa
CREATE TABLE IF NOT EXISTS public.evolution_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  instance_name TEXT,
  status TEXT,
  is_webhook_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. A coluna nova: a empresa dona da instância
ALTER TABLE public.evolution_instances
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3. Derrubar as constraints UNIQUE herdadas (a de user_id, criada fora de migração,
--    de nome desconhecido). A tabela tem 0 linhas; nada se perde.
--    Lição da 20260717030000/040000: derruba-se a CONSTRAINT, nunca o índice que a sustenta.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.evolution_instances'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.evolution_instances DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 4. Uma instância por empresa
CREATE UNIQUE INDEX IF NOT EXISTS evolution_instances_tenant_uniq
  ON public.evolution_instances (tenant_id);

-- 5. Documentação
COMMENT ON COLUMN public.evolution_instances.tenant_id IS 'Empresa dona da instância de WhatsApp. Uma por tenant.';
COMMENT ON COLUMN public.evolution_instances.user_id IS 'Quem conectou (auditoria). A posse é do tenant, não da pessoa.';
