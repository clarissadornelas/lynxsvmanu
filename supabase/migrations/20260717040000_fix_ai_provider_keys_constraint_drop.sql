-- Migration: Fix the failed migration by dropping the CONSTRAINT first
-- The previous migration (20260717030000) failed because it tried to DROP INDEX
-- on an index that backs a UNIQUE constraint. PostgreSQL requires dropping the
-- constraint itself, which also drops the backing index.

-- 1. Drop the legacy unique CONSTRAINT (this also drops its backing index)
ALTER TABLE public.ai_provider_keys
  DROP CONSTRAINT IF EXISTS ai_provider_keys_user_provider_key;

-- 2. Drop the partial unique index (may already be gone from the failed migration)
DROP INDEX IF EXISTS public.ai_provider_keys_tenant_provider_uniq;

-- 3. Drop the legacy unique index if it somehow still exists separately
DROP INDEX IF EXISTS public.ai_provider_keys_user_provider_key;

-- 4. Drop the non-unique index on (tenant_id, provider) so we can replace it
DROP INDEX IF EXISTS public.ai_provider_keys_tenant_provider_idx;

-- 5. Create a standard unique index on (tenant_id, provider) for ON CONFLICT upserts
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_tenant_provider_uniq
  ON public.ai_provider_keys (tenant_id, provider);
