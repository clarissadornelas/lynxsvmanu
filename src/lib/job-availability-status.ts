import type { Json } from '@/lib/supabase/types'

export type AvailabilityStatus = 'ativa' | 'vencida' | 'sem_agenda'

interface AvailabilityResult {
  status: AvailabilityStatus
  label: string
  color: string
  badgeClass: string
}

const RESULTS: Record<AvailabilityStatus, AvailabilityResult> = {
  ativa: {
    status: 'ativa',
    label: 'Agenda ativa',
    color: '#16a34a',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  vencida: {
    status: 'vencida',
    label: 'Prazo de agendamento vencido',
    color: '#d97706',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  sem_agenda: {
    status: 'sem_agenda',
    label: 'Sem agenda',
    color: '#64748b',
    badgeClass: 'bg-slate-200 text-slate-600',
  },
}

interface TimeBlock {
  inicio: string
  fim: string
}

interface ParsedJanela {
  semana?: Record<string, TimeBlock[]>
}

function hasWeeklyBlocks(janela: Json | null): boolean {
  if (!janela || typeof janela !== 'object') return false
  const parsed = janela as ParsedJanela
  if (!parsed.semana || typeof parsed.semana !== 'object') return false
  for (const blocks of Object.values(parsed.semana)) {
    if (Array.isArray(blocks) && blocks.length > 0) {
      return true
    }
  }
  return false
}

function isDeadlinePassed(dataLimite: string | null): boolean {
  if (!dataLimite) return false
  const deadline = new Date(dataLimite)
  if (isNaN(deadline.getTime())) return false
  return deadline.getTime() < Date.now()
}

export function getAvailabilityStatus(
  janela: Json | null,
  dataLimite: string | null,
): AvailabilityResult {
  const hasBlocks = hasWeeklyBlocks(janela)

  if (!hasBlocks) {
    return RESULTS.sem_agenda
  }

  if (isDeadlinePassed(dataLimite)) {
    return RESULTS.vencida
  }

  return RESULTS.ativa
}
