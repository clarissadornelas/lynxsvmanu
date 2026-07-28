ALTER TABLE public.entrevistas ADD COLUMN IF NOT EXISTS notas text;

ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_status_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_status_check 
  CHECK (status = ANY (ARRAY[
    'novo', 'shortlist', 'contatado', 'agendado', 'entrevistado', 'aprovado', 'reprovado', 'contratado', 'descartado',
    'Entrevistado - Aprovado', 'Entrevistado - Reprovado', 'Entrevistado - Em Análise'
  ]));

DROP POLICY IF EXISTS "authenticated_all_entrevistas" ON public.entrevistas;
DROP POLICY IF EXISTS "tenant_isolation_entrevistas" ON public.entrevistas;
CREATE POLICY "tenant_isolation_entrevistas" ON public.entrevistas
  FOR ALL TO authenticated
  USING (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', tenant_id::text)
  );
