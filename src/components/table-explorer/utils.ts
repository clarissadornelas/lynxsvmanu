import type { Json } from '@/lib/supabase/types'

export interface TableDef {
  name: string
  label: string
}

export const DB_TABLES: TableDef[] = [
  { name: 'candidatos', label: 'Candidatos' },
  { name: 'acesso_agentes', label: 'Acesso Agentes' },
  { name: 'acoes_agente', label: 'Ações Agente' },
  { name: 'configuracoes_agente', label: 'Configurações Agente' },
  { name: 'vagas', label: 'Vagas' },
  { name: 'candidato_eventos', label: 'Candidato Eventos' },
  { name: 'agendamentos', label: 'Agendamentos' },
  { name: 'entrevistas', label: 'Entrevistas' },
  { name: 'base_ativa', label: 'Base Ativa' },
  { name: 'conversas', label: 'Conversas' },
  { name: 'mensagens', label: 'Mensagens' },
  { name: 'processos', label: 'Processos' },
  { name: 'follow_ups', label: 'Follow Ups' },
  { name: 'disponibilidade', label: 'Disponibilidade' },
  { name: 'disparos', label: 'Disparos' },
  { name: 'tenants', label: 'Tenants' },
  { name: 'ai_agents', label: 'AI Agents' },
  { name: 'ai_provider_keys', label: 'AI Provider Keys' },
  { name: 'jobs', label: 'Jobs' },
  { name: 'usage_events', label: 'Usage Events' },
  { name: 'entitlements', label: 'Entitlements' },
  { name: 'feriados_customizados', label: 'Feriados Customizados' },
  { name: 'evolution_instances', label: 'Evolution Instances' },
  { name: 'whatsapp_conversations', label: 'WhatsApp Conversations' },
  { name: 'whatsapp_messages', label: 'WhatsApp Messages' },
  { name: 'agendas_externas', label: 'Agendas Externas' },
  { name: 'bloqueios_agenda', label: 'Bloqueios de Agenda' },
  { name: 'eventos_agenda_externa', label: 'Eventos de Agenda Externa' },
  { name: 'usuarios', label: 'Usuários' },
  { name: 'logs_exclusao', label: 'Logs de Exclusão' },
  { name: 'pedidos', label: 'Pedidos' },
  { name: 'chamados', label: 'Chamados' },
]

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function isJsonValue(value: unknown): boolean {
  return (
    (typeof value === 'object' && value !== null && !Array.isArray(value) === false) ||
    (typeof value === 'object' && value !== null)
  )
}

export function getColumns(data: Record<string, unknown>[]): string[] {
  if (data.length === 0) return []
  const colSet = new Set<string>()
  data.forEach((row) => {
    Object.keys(row).forEach((k) => colSet.add(k))
  })
  return Array.from(colSet)
}

export function exportToCsv(data: Record<string, unknown>[], columns: string[], filename: string) {
  const BOM = '\uFEFF'
  const escapeCsv = (val: unknown): string => {
    const formatted = formatCellValue(val)
    if (formatted.includes(',') || formatted.includes('"') || formatted.includes('\n')) {
      return `"${formatted.replace(/"/g, '""')}"`
    }
    return formatted
  }

  const header = columns.map(escapeCsv).join(',')
  const rows = data.map((row) => columns.map((col) => escapeCsv(row[col])).join(','))

  const csv = BOM + header + '\n' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function sortData(
  data: Record<string, unknown>[],
  column: string,
  direction: 'asc' | 'desc',
): Record<string, unknown>[] {
  return [...data].sort((a, b) => {
    const aVal = a[column]
    const bVal = b[column]
    if (aVal === null || aVal === undefined) return direction === 'asc' ? 1 : -1
    if (bVal === null || bVal === undefined) return direction === 'asc' ? -1 : 1
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal)
    const bStr = String(bVal)
    return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
  })
}

export function searchFilter(
  data: Record<string, unknown>[],
  query: string,
): Record<string, unknown>[] {
  if (!query.trim()) return data
  const lower = query.toLowerCase()
  return data.filter((row) =>
    Object.values(row).some((v) => {
      if (v === null || v === undefined) return false
      if (typeof v === 'object') {
        return JSON.stringify(v).toLowerCase().includes(lower)
      }
      return String(v).toLowerCase().includes(lower)
    }),
  )
}

export type { Json }
