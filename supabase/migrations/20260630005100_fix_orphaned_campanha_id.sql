-- 1. Clean up orphaned campanha_id references in vagas
UPDATE public.vagas
SET campanha_id = NULL
WHERE campanha_id IS NOT NULL
  AND campanha_id NOT IN (SELECT id FROM public.campanhas);

-- 2. Clean up orphaned campanha_id references in candidatos
UPDATE public.candidatos
SET campanha_id = NULL
WHERE campanha_id IS NOT NULL
  AND campanha_id NOT IN (SELECT id FROM public.campanhas);

-- 3. Clean up orphaned campanha_id in agendamentos
UPDATE public.agendamentos
SET campanha_id = NULL
WHERE campanha_id IS NOT NULL
  AND campanha_id NOT IN (SELECT id FROM public.campanhas);

-- 4. Clean up orphaned campanha_id in entrevistas
UPDATE public.entrevistas
SET campanha_id = NULL
WHERE campanha_id IS NOT NULL
  AND campanha_id NOT IN (SELECT id FROM public.campanhas);

-- 5. Recreate sync_candidato_campanha_vaga trigger to handle orphaned references safely
CREATE OR REPLACE FUNCTION public.sync_candidato_campanha_vaga()
RETURNS trigger AS $$
DECLARE
  v_campanha_id uuid;
BEGIN
  IF NEW.vaga_id IS NOT NULL THEN
    SELECT campanha_id INTO v_campanha_id FROM public.vagas WHERE id = NEW.vaga_id;

    IF v_campanha_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.campanhas WHERE id = v_campanha_id) THEN
        NEW.campanha_id := v_campanha_id;
      ELSE
        NEW.campanha_id := NULL;
      END IF;
    ELSE
      NEW.campanha_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_candidato_campanha_vaga ON public.candidatos;
CREATE TRIGGER sync_candidato_campanha_vaga
  BEFORE INSERT OR UPDATE ON public.candidatos
  FOR EACH ROW EXECUTE FUNCTION public.sync_candidato_campanha_vaga();

-- 6. Recreate sync_agendamento_campanha_vaga trigger similarly
CREATE OR REPLACE FUNCTION public.sync_agendamento_campanha_vaga()
RETURNS trigger AS $$
DECLARE
  v_campanha_id uuid;
BEGIN
  IF NEW.vaga_id IS NOT NULL THEN
    SELECT campanha_id INTO v_campanha_id FROM public.vagas WHERE id = NEW.vaga_id;

    IF v_campanha_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.campanhas WHERE id = v_campanha_id) THEN
        NEW.campanha_id := v_campanha_id;
      ELSE
        NEW.campanha_id := NULL;
      END IF;
    ELSE
      NEW.campanha_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_agendamento_campanha_vaga ON public.agendamentos;
CREATE TRIGGER sync_agendamento_campanha_vaga
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_agendamento_campanha_vaga();

-- 7. Recreate sync_entrevista_campanha_vaga trigger similarly
CREATE OR REPLACE FUNCTION public.sync_entrevista_campanha_vaga()
RETURNS trigger AS $$
DECLARE
  v_campanha_id uuid;
BEGIN
  IF NEW.vaga_id IS NOT NULL THEN
    SELECT campanha_id INTO v_campanha_id FROM public.vagas WHERE id = NEW.vaga_id;

    IF v_campanha_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.campanhas WHERE id = v_campanha_id) THEN
        NEW.campanha_id := v_campanha_id;
      ELSE
        NEW.campanha_id := NULL;
      END IF;
    ELSE
      NEW.campanha_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_entrevista_campanha_vaga ON public.entrevistas;
CREATE TRIGGER sync_entrevista_campanha_vaga
  BEFORE INSERT OR UPDATE ON public.entrevistas
  FOR EACH ROW EXECUTE FUNCTION public.sync_entrevista_campanha_vaga();
