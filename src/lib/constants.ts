export interface AgentInfo {
  key: string
  name: string
  price: number
  numericId: string
  plan: string
}

export const AGENTS: AgentInfo[] = [
  { key: 'assessor', name: 'Meu Assessor', price: 2490, numericId: '01', plan: 'Assessor' },
  { key: 'copiloto', name: 'Copiloto', price: 2990, numericId: '02', plan: 'Copiloto' },
  { key: 'base_ativa', name: 'Base Ativa', price: 1990, numericId: '03', plan: 'Base Ativa' },
]

export const AGENT_BY_KEY: Record<string, AgentInfo> = Object.fromEntries(
  AGENTS.map((a) => [a.key, a]),
)

export const AGENT_BY_NUMERIC_ID: Record<string, AgentInfo> = Object.fromEntries(
  AGENTS.map((a) => [a.numericId, a]),
)

export const BUNDLE_PRICE = 5990

export const BUNDLE_SAVINGS = AGENTS.reduce((sum, a) => sum + a.price, 0) - BUNDLE_PRICE

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export const PLAN_NAME = 'mensal'

export const PEDIDO_STATUS_STYLES: Record<string, string> = {
  cortesia: 'bg-green-100 text-green-700 hover:bg-green-100',
  aguardando_pagamento: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  pago: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  cancelado: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
}

export const PEDIDO_STATUS_LABELS: Record<string, string> = {
  cortesia: 'Cortesia',
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  cancelado: 'Cancelado',
}

export const CHAMADO_STATUS_STYLES: Record<string, string> = {
  aberto: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  respondido: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  fechado: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
}

export const CHAMADO_STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  respondido: 'Respondido',
  fechado: 'Fechado',
}
