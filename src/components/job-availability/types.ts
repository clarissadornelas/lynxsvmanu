import type { Json } from '@/lib/supabase/types'

export interface TimeBlock {
  inicio: string
  fim: string
}

export type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'

export interface DateException {
  data: string
  tipo: 'bloqueio' | 'abertura'
  blocos?: TimeBlock[]
}

export interface JanelaConfig {
  fuso: string
  duracao_min: number
  semana: Record<DayKey, TimeBlock[]>
  excecoes: DateException[]
}

export const DAY_LABELS: { key: DayKey; label: string }[] = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]

export function defaultJanela(): JanelaConfig {
  const empty: Record<DayKey, TimeBlock[]> = {
    seg: [],
    ter: [],
    qua: [],
    qui: [],
    sex: [],
    sab: [],
    dom: [],
  }
  return {
    fuso: 'America/Sao_Paulo',
    duracao_min: 45,
    semana: empty,
    excecoes: [],
  }
}

export function parseJanela(raw: Json | null): JanelaConfig {
  if (!raw || typeof raw !== 'object') return defaultJanela()
  const obj = raw as Record<string, unknown>
  const semana = (obj.semana as JanelaConfig['semana']) || defaultJanela().semana
  return {
    fuso: (obj.fuso as string) || 'America/Sao_Paulo',
    duracao_min: (obj.duracao_min as number) || 45,
    semana,
    excecoes: (obj.excecoes as DateException[]) || [],
  }
}
