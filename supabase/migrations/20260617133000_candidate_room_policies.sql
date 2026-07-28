DO $$
BEGIN
  -- Add em_andamento to agendamentos status if not exists
  ALTER TABLE public.agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;
  ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_status_check 
    CHECK (status = ANY (ARRAY['agendada'::text, 'confirmada'::text, 'em_andamento'::text, 'realizada'::text, 'no_show'::text, 'cancelada'::text, 'aguardando_parecer'::text]));
END $$;

-- Allow anonymous candidates to view basic info for the room
DROP POLICY IF EXISTS "anon_select_entrevistas" ON public.entrevistas;
CREATE POLICY "anon_select_entrevistas" ON public.entrevistas
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_select_candidatos" ON public.candidatos;
CREATE POLICY "anon_select_candidatos" ON public.candidatos
  FOR SELECT TO anon USING (true);

-- Allow anonymous candidates to accept LGPD
DROP POLICY IF EXISTS "anon_update_candidatos" ON public.candidatos;
CREATE POLICY "anon_update_candidatos" ON public.candidatos
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_vagas" ON public.vagas;
CREATE POLICY "anon_select_vagas" ON public.vagas
  FOR SELECT TO anon USING (true);
