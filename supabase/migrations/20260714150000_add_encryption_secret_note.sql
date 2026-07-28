-- Migration: Add tracking for encryption secret configuration
-- This migration documents the encryption secret requirement and adds
-- a helpful comment to the ai_provider_keys table for future reference.

COMMENT ON TABLE public.ai_provider_keys IS 'Stores encrypted API keys for AI providers. Keys are encrypted using AES-GCM with PBKDF2 key derivation. The encryption secret is read from ENCRYPTION_SECRET env var (preferred) or SUPABASE_SERVICE_ROLE_KEY (fallback). If decryption fails, run the re-encrypt-keys edge function to migrate keys to the new secret.';

-- Add an index to speed up lookups by provider (if not already present)
CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_provider ON public.ai_provider_keys(provider);
