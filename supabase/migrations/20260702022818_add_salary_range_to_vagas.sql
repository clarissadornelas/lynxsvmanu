-- Add salary range columns to vagas table
-- Idempotent: safe to run multiple times
-- No constraints, checks, triggers, or indexes

ALTER TABLE public.vagas
ADD COLUMN IF NOT EXISTS salario_min numeric;

ALTER TABLE public.vagas
ADD COLUMN IF NOT EXISTS salario_max numeric;

ALTER TABLE public.vagas
ADD COLUMN IF NOT EXISTS salario_moeda text DEFAULT 'BRL';
