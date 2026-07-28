-- Migration: Add tenant_id to ai_provider_keys for multi-tenant key association
-- Stage 1 of 3: Database schema update only (no app code changes)

-- 1. Add nullable tenant_id column (no default, existing rows remain valid)
ALTER TABLE public.ai_provider_keys
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- 2. Add foreign key constraint referencing tenants(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_provider_keys_tenant_id_fkey'
      AND conrelid = 'public.ai_provider_keys'::regclass
  ) THEN
    ALTER TABLE public.ai_provider_keys
      ADD CONSTRAINT ai_provider_keys_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
  END IF;
END $$;

-- 3. Non-unique index for efficient lookups by tenant + provider
CREATE INDEX IF NOT EXISTS ai_provider_keys_tenant_provider_idx
  ON public.ai_provider_keys (tenant_id, provider);

-- 4. Partial unique index to enforce one key per provider per tenant
--    (only when tenant_id is NOT NULL, so legacy user-only rows are unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_tenant_provider_uniq
  ON public.ai_provider_keys (tenant_id, provider)
  WHERE tenant_id IS NOT NULL;

-- 5. Document the column
COMMENT ON COLUMN public.ai_provider_keys.tenant_id IS 'Empresa dona da chave. Preenchido por provider-save-key. Só admin do tenant salva.';
