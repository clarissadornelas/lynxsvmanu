-- ============================================
-- Migration: Resume Analysis - Storage bucket and curriculos table
-- Supports PDF/DOCX upload and structured data extraction
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('curriculos', 'curriculos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "curriculos_upload" ON storage.objects;
CREATE POLICY "curriculos_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'curriculos');

DROP POLICY IF EXISTS "curriculos_read" ON storage.objects;
CREATE POLICY "curriculos_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'curriculos');

DROP POLICY IF EXISTS "curriculos_update" ON storage.objects;
CREATE POLICY "curriculos_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'curriculos') WITH CHECK (bucket_id = 'curriculos');

DROP POLICY IF EXISTS "curriculos_delete" ON storage.objects;
CREATE POLICY "curriculos_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'curriculos');

CREATE TABLE IF NOT EXISTS public.curriculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  arquivo_tipo TEXT NOT NULL CHECK (arquivo_tipo IN ('pdf', 'docx')),
  arquivo_url TEXT,
  arquivo_tamanho_bytes BIGINT,
  dados_estruturados JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'processado', 'falhou')),
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ
);

ALTER TABLE public.curriculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_curriculos" ON public.curriculos;
CREATE POLICY "authenticated_all_curriculos" ON public.curriculos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_curriculos" ON public.curriculos;
CREATE POLICY "anon_select_curriculos" ON public.curriculos
  FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS curriculos_tenant_idx ON public.curriculos(tenant_id);
CREATE INDEX IF NOT EXISTS curriculos_candidato_idx ON public.curriculos(candidato_id);
CREATE INDEX IF NOT EXISTS curriculos_status_idx ON public.curriculos(status);
