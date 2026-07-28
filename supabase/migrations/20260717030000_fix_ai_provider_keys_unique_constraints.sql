-- Migration: Fix AI provider keys unique constraints for proper multi-tenant key management
-- Drops the partial unique index and legacy user_id-based unique constraint,
-- then creates a standard unique index on (tenant_id, provider) for ON CONFLICT upserts.

-- 1. Drop the partial unique index (had WHERE tenant_id IS NOT NULL clause)
DROP INDEX IF EXISTS public.ai_provider_keys_tenant_provider_uniq;

-- 2. Drop the legacy unique constraint on (user_id, provider)
--    This also drops its backing index automatically.
--    Must drop the CONSTRAINT (not the INDEX) because Postgres refuses
--    DROP INDEX on an index that backs a constraint.
ALTER TABLE public.ai_provider_keys
  DROP CONSTRAINT IF EXISTS ai_provider_keys_user_provider_key;

--    Now safe to drop the index if it somehow still exists independently
DROP INDEX IF EXISTS public.ai_provider_keys_user_provider_key;

-- 3. Drop the non-unique index on (tenant_id, provider) so we can replace it with unique
DROP INDEX IF EXISTS public.ai_provider_keys_tenant_provider_idx;

-- 4. Create a standard unique index on (tenant_id, provider) without any WHERE clause
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_tenant_provider_uniq
  ON public.ai_provider_keys (tenant_id, provider);
