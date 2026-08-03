-- Adiciona as colunas ativo e modo a configuracoes_agente.
--
-- Este arquivo continha tambem um CREATE TABLE IF NOT EXISTS de
-- public.configuracoes_agente com schema obsoleto: colunas agente_id, tipo_agente e
-- criterios, mais uma chave estrangeira para public.ai_agents, que e tabela fantasma do
-- projeto. Alem disso tipo_agente foi renomeado para agent_type em migracao posterior.
--
-- O bloco era inerte no banco atual porque a tabela ja existe, mas num banco limpo
-- criaria configuracoes_agente com schema divergente do de producao e quebraria as
-- migracoes seguintes. Foi removido. A criacao da tabela pertence a migracao que a
-- criou originalmente, nao a esta.

ALTER TABLE public.configuracoes_agente
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'real' CHECK (modo IN ('real', 'ensaio'));
