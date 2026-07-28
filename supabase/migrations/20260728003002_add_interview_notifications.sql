-- ============================================
-- Migration: Interview Scheduling - Notification tracking
-- Adds email notification columns to agendamentos
-- Creates notificacoes_entrevista table for notification log
-- ============================================

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS notificacao_email_enviada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificacao_email_enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_destinatario TEXT;

CREATE TABLE IF NOT EXISTS public.notificacoes_entrevista (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  candidato_id UUID REFERENCES public.candidatos(id) ON DELETE SET NULL,
  vaga_id UUID REFERENCES public.vagas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'email' CHECK (tipo IN ('email', 'whatsapp', 'sms')),
  destinatario TEXT NOT NULL,
  assunto TEXT,
  corpo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviada', 'falhou', 'lida')),
  enviada_em TIMESTAMPTZ,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notificacoes_entrevista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_notificacoes_entrevista" ON public.notificacoes_entrevista;
CREATE POLICY "authenticated_all_notificacoes_entrevista" ON public.notificacoes_entrevista
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_notificacoes_entrevista" ON public.notificacoes_entrevista;
CREATE POLICY "anon_select_notificacoes_entrevista" ON public.notificacoes_entrevista
  FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS ne_tenant_idx ON public.notificacoes_entrevista(tenant_id);
CREATE INDEX IF NOT EXISTS ne_agendamento_idx ON public.notificacoes_entrevista(agendamento_id);
CREATE INDEX IF NOT EXISTS ne_candidato_idx ON public.notificacoes_entrevista(candidato_id);
CREATE INDEX IF NOT EXISTS ne_status_idx ON public.notificacoes_entrevista(status);
