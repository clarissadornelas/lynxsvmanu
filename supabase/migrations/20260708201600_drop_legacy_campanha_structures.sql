-- ============================================================
-- FASE 3: Permanent removal of legacy Campanha structures
-- Drops campanha_id columns and campanhas/agente_campanha tables.
-- NO CASCADE — if dependencies exist, the migration will fail.
-- ============================================================

-- 1. Drop campanha_id columns from dependent tables (order matters)
ALTER TABLE public.vagas DROP COLUMN IF EXISTS campanha_id;
ALTER TABLE public.candidatos DROP COLUMN IF EXISTS campanha_id;
ALTER TABLE public.agendamentos DROP COLUMN IF EXISTS campanha_id;
ALTER TABLE public.entrevistas DROP COLUMN IF EXISTS campanha_id;
ALTER TABLE public.processos DROP COLUMN IF EXISTS campanha_id;
ALTER TABLE public.disponibilidade DROP COLUMN IF EXISTS campanha_id;

-- 2. Drop legacy junction table
DROP TABLE IF EXISTS public.agente_campanha;

-- 3. Drop main campanhas table
DROP TABLE IF EXISTS public.campanhas;

-- ============================================================
-- Verification: confirm tables no longer exist
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campanhas') THEN
    RAISE EXCEPTION 'Table public.campanhas still exists — migration incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agente_campanha') THEN
    RAISE EXCEPTION 'Table public.agente_campanha still exists — migration incomplete';
  END IF;
  RAISE NOTICE 'Campanha legacy structures successfully removed.';
END $$;

-- ============================================================
-- Verify no legacy sync triggers remain
-- ============================================================
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'sync_campanha_vaga',
    'sync_candidato_campanha_vaga',
    'sync_agendamento_campanha_vaga',
    'sync_entrevista_campanha_vaga'
  )
ORDER BY event_object_table, trigger_name;
