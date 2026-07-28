import { supabase } from '@/lib/supabase/client'

export interface PlanejadorSummary {
  tenants_processados: number
  acoes_criadas: number
  detalhamento: {
    follow_up_base: number
    cobranca_sem_resposta: number
    lembrete_roteiro: number
  }
}

export interface ExecutorSummary {
  processadas: number
  concluidas: number
  simuladas: number
  escaladas: number
  falhas: number
}

export async function triggerPlanejador(): Promise<{
  data: PlanejadorSummary | null
  error: unknown
}> {
  const { data, error } = await supabase.functions.invoke('agentes-planejador', {
    body: { task: 'plan' },
  })
  return { data: data as PlanejadorSummary | null, error }
}

export async function triggerExecutor(): Promise<{
  data: ExecutorSummary | null
  error: unknown
}> {
  const { data, error } = await supabase.functions.invoke('agentes-executor', {
    body: { task: 'execute' },
  })
  return { data: data as ExecutorSummary | null, error }
}
