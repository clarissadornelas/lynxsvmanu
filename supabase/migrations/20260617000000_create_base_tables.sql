-- ============================================
-- Migration: Create all base tables required by the 51 existing migrations
-- Must run BEFORE 20260617034751_fix_rls_and_seed.sql
-- Target database starts with zero tables in public schema
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  nome TEXT,
  headhunter_nome TEXT,
  headhunter_telefone TEXT,
  janela_inicio INTEGER,
  janela_fim INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entitlements (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  ag1_assessor BOOLEAN DEFAULT false,
  ag2_copiloto BOOLEAN DEFAULT false,
  ag3_ativador BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo TEXT,
  empresa TEXT,
  descricao TEXT,
  modelo_entrevista TEXT,
  status TEXT,
  campanha_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  vaga_id UUID REFERENCES public.vagas(id) ON DELETE SET NULL,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  status TEXT,
  score INTEGER,
  score_obs TEXT,
  origem TEXT,
  contratado_em TIMESTAMPTZ,
  campanha_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entrevistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  vaga_id UUID REFERENCES public.vagas(id) ON DELETE SET NULL,
  candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
  status TEXT,
  disc JSONB,
  transcricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  campanha_id UUID
);

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  vaga_id UUID REFERENCES public.vagas(id) ON DELETE SET NULL,
  candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
  status TEXT,
  data_hora TIMESTAMPTZ,
  duracao_minutos INTEGER,
  campanha_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.base_ativa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT,
  telefone TEXT,
  email TEXT,
  cadencia_dias INTEGER,
  ultimo_ping_em TIMESTAMPTZ,
  status_profissional TEXT,
  abertura TEXT,
  origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
  contexto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID REFERENCES public.conversas(id) ON DELETE CASCADE,
  direcao TEXT,
  conteudo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agente_campanha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID REFERENCES public.campanhas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
  campanha_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.disparos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evolution_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  instance_name TEXT,
  status TEXT,
  is_webhook_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tenants', 'entitlements', 'vagas', 'candidatos', 'entrevistas',
    'agendamentos', 'base_ativa', 'conversas', 'mensagens', 'campanhas',
    'agente_campanha', 'processos', 'disponibilidade', 'disparos',
    'jobs', 'usage_events', 'ai_agents', 'ai_provider_keys', 'evolution_instances'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
