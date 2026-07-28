DO $block$
DECLARE
  v_tenant_id uuid;
  v_cand1_id uuid;
  v_cand2_id uuid;
  v_vaga_id uuid;
  v_conv1_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'agencia-lit' LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    SELECT id INTO v_cand1_id FROM public.candidatos WHERE email = 'hired30@test.com' LIMIT 1;
    SELECT id INTO v_cand2_id FROM public.candidatos WHERE email = 'rejected@test.com' LIMIT 1;
    
    IF v_cand1_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.vagas WHERE tenant_id = v_tenant_id AND titulo = 'Software Engineer') THEN
        INSERT INTO public.vagas (id, tenant_id, titulo, descricao)
        VALUES (gen_random_uuid(), v_tenant_id, 'Software Engineer', 'Backend Dev');
      END IF;

      SELECT id INTO v_vaga_id FROM public.vagas WHERE tenant_id = v_tenant_id AND titulo = 'Software Engineer' LIMIT 1;

      UPDATE public.candidatos SET vaga_id = v_vaga_id WHERE id = v_cand1_id;

      IF NOT EXISTS (SELECT 1 FROM public.entrevistas WHERE candidato_id = v_cand1_id) THEN
        INSERT INTO public.entrevistas (id, tenant_id, vaga_id, candidato_id, status, disc, criado_em)
        VALUES (
          gen_random_uuid(), v_tenant_id, v_vaga_id, v_cand1_id, 'analisada',
          '{"perfil": "DI", "detalhes": {"D": 80, "I": 70, "S": 30, "C": 40}}'::jsonb,
          now() - interval '32 days'
        );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM public.conversas WHERE candidato_id = v_cand1_id) THEN
        INSERT INTO public.conversas (id, tenant_id, candidato_id, contexto)
        VALUES (gen_random_uuid(), v_tenant_id, v_cand1_id, 'headhunter')
        RETURNING id INTO v_conv1_id;

        INSERT INTO public.mensagens (id, conversa_id, direcao, conteudo, criado_em)
        VALUES 
          (gen_random_uuid(), v_conv1_id, 'saida', 'Olá! Tudo bem? Tenho uma oportunidade perfeita para você.', now() - interval '35 days'),
          (gen_random_uuid(), v_conv1_id, 'entrada', 'Tudo ótimo! Quero saber mais.', now() - interval '34 days');
      END IF;
    END IF;
  END IF;
END $block$;
