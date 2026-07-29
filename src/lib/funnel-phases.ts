import type { Candidate } from '@/stores/useRecruitmentStore'

export interface FunnelPhase {
  id: 'novo' | 'shortlist' | 'agendado' | 'entrevistado' | 'contratado'
  label: string
  badgeClass: string
  dotClass: string
  textClass: string
  tooltip: string
}

export const FUNNEL_PHASES: FunnelPhase[] = [
  {
    id: 'novo',
    label: 'A Triar',
    badgeClass: 'bg-slate-200 text-slate-700',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-700',
    tooltip:
      'Candidatos recém-chegados da ingestão de CV, aguardando triagem. Fonte: status do candidato.',
  },
  {
    id: 'shortlist',
    label: 'Shortlist',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-700',
    tooltip: 'Aprovados na triagem, elegíveis para contato. Fonte: status do candidato.',
  },
  {
    id: 'agendado',
    label: 'Agendados',
    badgeClass: 'bg-amber-100 text-amber-700',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    tooltip: 'Com reunião marcada. Fonte: status do candidato.',
  },
  {
    id: 'entrevistado',
    label: 'Entrevistados',
    badgeClass: 'bg-blue-100 text-blue-700',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700',
    tooltip: 'Entrevista realizada, aguardando decisão. Fonte: status do candidato.',
  },
  {
    id: 'contratado',
    label: 'Contratados',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    tooltip: 'Fecharam a vaga. Fonte: status do candidato.',
  },
]

export function phaseCount(candidates: Candidate[], id: FunnelPhase['id']): number {
  return candidates.filter((c) => c.status === id).length
}

export type KanbanColumnId =
  | 'a_triar'
  | 'longlist'
  | 'em_entrevista'
  | 'shortlist_final'
  | 'contratado'

export interface KanbanColumn {
  id: KanbanColumnId
  label: string
  tooltip: string
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'a_triar',
    label: 'A Triar',
    tooltip: 'Candidatos recém-chegados, aguardando triagem.',
  },
  {
    id: 'longlist',
    label: 'Longlist',
    tooltip: 'Aprovados na triagem, elegíveis para contato.',
  },
  {
    id: 'em_entrevista',
    label: 'Em entrevista',
    tooltip: 'Em alguma rodada de entrevista da vaga.',
  },
  {
    id: 'shortlist_final',
    label: 'Shortlist',
    tooltip: 'Passaram por todas as rodadas. Finalistas a comparar.',
  },
  {
    id: 'contratado',
    label: 'Contratado',
    tooltip: 'Fechou a vaga.',
  },
]

export interface EtapaVaga {
  n: number
  nome: string
  tipo: string
  agenda_id: string | null
  duracao: number
}

export function parseEtapas(raw: unknown): EtapaVaga[] {
  if (!Array.isArray(raw)) return []
  const parsed = raw
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(
      (e, i): EtapaVaga => ({
        n: typeof e.n === 'number' ? e.n : i + 1,
        nome: typeof e.nome === 'string' ? e.nome : `Rodada ${i + 1}`,
        tipo: typeof e.tipo === 'string' ? e.tipo : 'rh',
        agenda_id: e.agenda_id == null ? null : String(e.agenda_id),
        duracao: typeof e.duracao === 'number' ? e.duracao : 60,
      }),
    )
  parsed.sort((a, b) => a.n - b.n)
  return parsed
}

export function deriveKanbanColumn(
  status: string,
  etapaAtual: number,
  totalRodadas: number,
): KanbanColumnId {
  if (status === 'contratado') return 'contratado'
  if (status === 'novo') return 'a_triar'
  if (status === 'shortlist') return 'longlist'
  if (status === 'agendado' || status === 'entrevistado') {
    if (etapaAtual <= totalRodadas) return 'em_entrevista'
    return 'shortlist_final'
  }
  return 'a_triar'
}

export interface CopilotStage {
  id: 'a_preparar' | 'pronta' | 'a_analisar' | 'analisada'
  label: string
  badgeClass: string
  dotClass: string
  textClass: string
  hint: string
}

export const COPILOT_STAGES: CopilotStage[] = [
  {
    id: 'a_preparar',
    label: 'A Preparar',
    badgeClass: 'bg-amber-100 text-amber-700',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    hint: 'agendados sem roteiro',
  },
  {
    id: 'pronta',
    label: 'Prontas',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-700',
    hint: 'roteiro pronto, aguardando',
  },
  {
    id: 'a_analisar',
    label: 'A Analisar',
    badgeClass: 'bg-blue-100 text-blue-700',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700',
    hint: 'realizadas sem transcrição',
  },
  {
    id: 'analisada',
    label: 'Analisadas',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    hint: 'prontas pra decisão',
  },
]

export function deriveCopilotStage(
  interview: any | null | undefined,
  activeAppointment: any | null | undefined,
): CopilotStage['id'] {
  if (interview) {
    if (interview.status === 'analisada' || interview.status === 'entregue') {
      return 'analisada'
    }
    if (interview.status === 'roteiro_pronto') {
      return 'pronta'
    }
    if (interview.status === 'realizada' || interview.status === 'em_analise') {
      return 'a_analisar'
    }
    if (interview.status === 'aguardando') {
      return 'a_preparar'
    }
  }
  if (activeAppointment) {
    return 'a_preparar'
  }
  return 'a_preparar'
}
