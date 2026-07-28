import { supabase } from '@/lib/supabase/client'

export interface EventoData {
  id: string
  candidato_id: string
  de: string | null
  para: string | null
  tipo: string | null
  criado_em: string
  vaga_id: string | null
  tenant_id: string | null
}

export interface CandidatoReportData {
  id: string
  status: string
  criado_em: string
  vaga_id: string | null
}

export interface VagaOption {
  id: string
  titulo: string
}

export interface ReportRawData {
  eventos: EventoData[]
  candidatos: CandidatoReportData[]
}

export async function fetchVagasForFilter(tenantId: string): Promise<VagaOption[]> {
  const { data, error } = await supabase
    .from('vagas')
    .select('id, titulo')
    .eq('tenant_id', tenantId)
    .eq('status', 'aberta')
    .order('titulo', { ascending: true })
  if (error || !data) return []
  return data as VagaOption[]
}

export async function fetchReportData(
  tenantId: string,
  vagaId: string | null,
  daysWindow: number,
): Promise<ReportRawData> {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - daysWindow)
  const startDateIso = startDate.toISOString()

  let eventosQuery = supabase
    .from('candidato_eventos')
    .select('id, candidato_id, de, para, tipo, criado_em, vaga_id, tenant_id')
    .eq('tenant_id', tenantId)
    .gte('criado_em', startDateIso)

  if (vagaId) {
    eventosQuery = eventosQuery.eq('vaga_id', vagaId)
  }

  let candidatosQuery = supabase
    .from('candidatos')
    .select('id, status, criado_em, vaga_id')
    .eq('tenant_id', tenantId)

  if (vagaId) {
    candidatosQuery = candidatosQuery.eq('vaga_id', vagaId)
  }

  const [eventosRes, candidatosRes] = await Promise.all([
    eventosQuery.order('criado_em', { ascending: true }),
    candidatosQuery,
  ])

  return {
    eventos: (eventosRes.data || []) as EventoData[],
    candidatos: (candidatosRes.data || []) as CandidatoReportData[],
  }
}
