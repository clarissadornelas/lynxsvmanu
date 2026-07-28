DROP POLICY IF EXISTS "authenticated_all_base_ativa" ON public.base_ativa;
CREATE POLICY "authenticated_all_base_ativa" ON public.base_ativa FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_candidatos" ON public.candidatos;
CREATE POLICY "authenticated_all_candidatos" ON public.candidatos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_entrevistas" ON public.entrevistas;
CREATE POLICY "authenticated_all_entrevistas" ON public.entrevistas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_conversas" ON public.conversas;
CREATE POLICY "authenticated_all_conversas" ON public.conversas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_mensagens" ON public.mensagens;
CREATE POLICY "authenticated_all_mensagens" ON public.mensagens FOR ALL TO authenticated USING (true) WITH CHECK (true);
