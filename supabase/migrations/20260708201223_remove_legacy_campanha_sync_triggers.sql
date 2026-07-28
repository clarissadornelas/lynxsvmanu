-- ============================================================
-- Phase 1: Diagnosis (Read-Only verification)
-- Confirm existence of legacy triggers before removal.
-- NOTE: sync_campanha_vaga on vagas never existed — it is
-- the source column, not a sync target. Only candidatos,
-- agendamentos, and entrevistas had sync triggers.
-- ============================================================

-- Verify sync_candidato_campanha_vaga on candidatos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'candidatos'
      AND trigger_name = 'sync_candidato_campanha_vaga'
      AND trigger_schema = 'public'
  ) THEN
    RAISE NOTICE 'Trigger sync_candidato_campanha_vaga not found on public.candidatos — already removed.';
  END IF;
END $$;

-- Verify sync_agendamento_campanha_vaga on agendamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'agendamentos'
      AND trigger_name = 'sync_agendamento_campanha_vaga'
      AND trigger_schema = 'public'
  ) THEN
    RAISE NOTICE 'Trigger sync_agendamento_campanha_vaga not found on public.agendamentos — already removed.';
  END IF;
END $$;

-- Verify sync_entrevista_campanha_vaga on entrevistas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'entrevistas'
      AND trigger_name = 'sync_entrevista_campanha_vaga'
      AND trigger_schema = 'public'
  ) THEN
    RAISE NOTICE 'Trigger sync_entrevista_campanha_vaga not found on public.entrevistas — already removed.';
  END IF;
END $$;

-- ============================================================
-- Phase 2: Removal of triggers and functions
-- ============================================================

DROP TRIGGER IF EXISTS sync_candidato_campanha_vaga ON public.candidatos;
DROP TRIGGER IF EXISTS trg_sync_candidato_campanha_vaga ON public.candidatos;
DROP TRIGGER IF EXISTS sync_agendamento_campanha_vaga ON public.agendamentos;
DROP TRIGGER IF EXISTS trg_sync_agendamento_campanha_vaga ON public.agendamentos;
DROP TRIGGER IF EXISTS sync_entrevista_campanha_vaga ON public.entrevistas;
DROP TRIGGER IF EXISTS trg_sync_entrevista_campanha_vaga ON public.entrevistas;

DROP FUNCTION IF EXISTS public.sync_candidato_campanha_vaga() CASCADE;
DROP FUNCTION IF EXISTS public.sync_agendamento_campanha_vaga() CASCADE;
DROP FUNCTION IF EXISTS public.sync_entrevista_campanha_vaga() CASCADE;

-- ============================================================
-- Final inventory: list remaining triggers in public schema
-- to confirm the legacy triggers have been removed.
-- ============================================================

SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
