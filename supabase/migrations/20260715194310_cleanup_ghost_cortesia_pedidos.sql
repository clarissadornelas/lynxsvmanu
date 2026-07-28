-- ============================================
-- Migration: Cleanup Ghost Cortesia Pedidos
-- ============================================
-- Updates pedidos with status = 'cortesia' that do NOT have a corresponding
-- active (ativo = true) record in acesso_agentes for the same tenant_id and agente_id.
-- These are "ghost orders" — free access was granted but no active access exists.
-- No data is deleted; only the status is changed to 'cancelado' for historical accuracy.
-- ============================================

UPDATE public.pedidos p
SET status = 'cancelado'
WHERE p.status = 'cortesia'
  AND NOT EXISTS (
    SELECT 1
    FROM public.acesso_agentes a
    WHERE a.tenant_id = p.tenant_id
      AND a.agente_id = p.agente_id
      AND a.ativo = true
  );
