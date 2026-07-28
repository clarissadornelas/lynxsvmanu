-- Add foto_url column to candidatos
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Create public storage bucket for candidate photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-candidatos', 'fotos-candidatos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the fotos-candidatos bucket
DROP POLICY IF EXISTS "fotos_candidatos_upload" ON storage.objects;
CREATE POLICY "fotos_candidatos_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-candidatos');

DROP POLICY IF EXISTS "fotos_candidatos_read" ON storage.objects;
CREATE POLICY "fotos_candidatos_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'fotos-candidatos');

DROP POLICY IF EXISTS "fotos_candidatos_update" ON storage.objects;
CREATE POLICY "fotos_candidatos_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'fotos-candidatos') WITH CHECK (bucket_id = 'fotos-candidatos');

DROP POLICY IF EXISTS "fotos_candidatos_delete" ON storage.objects;
CREATE POLICY "fotos_candidatos_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'fotos-candidatos');
