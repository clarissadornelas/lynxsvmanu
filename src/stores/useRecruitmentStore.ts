import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { initActiveContext, getActiveTenantId } from '@/stores/useActiveContext'
import type { Database, Json } from '@/lib/supabase/types'

type VagaRow = Database['public']['Tables']['vagas']['Row']
type CandidatoRow = Database['public']['Tables']['candidatos']['Row']

export type CandidateStatus =
  | 'novo'
  | 'shortlist'
  | 'agendado'
  | 'em_teste'
  | 'entrevistado'
  | 'contratado'
  | 'descartado'
  | 'reprovado'
  | 'inativo'

export interface Score {
  experiencia: number
  tecnica: number
  cultura: number
  senioridade: number
  total: number
}

export interface Candidate {
  id: string
  jobId: string
  tenantId: string
  name: string
  role: string
  email: string
  phone: string
  status: CandidateStatus
  situacao: 'ativo' | 'pausado' | 'eliminado'
  situacaoEm: string | null
  motivoSaida: string | null
  faseSaida: string | null
  etapaAtual: number
  shortlistOrdem: number | null
  score: Score
  avatarUrl: string | null
  matchReasons: string[]
  skills: string[]
  history: Interaction[]
}

export interface Interaction {
  id: string
  date: string
  type: 'whatsapp_sent' | 'whatsapp_received' | 'system' | 'email'
  content: string
}

export interface Job {
  id: string
  title: string
  company: string
  description: string
  requirements: string
  active: boolean
  createdAt: string
  tenantId: string
  tenantName: string
  cargo: string
  status: string
  dataLimite: string | null
  codigo: string | null
  agentes: string[]
  janela: Json | null
  etapas: Json
  maxAgendamentos: number
  salarioMin: number | null
  salarioMax: number | null
  salarioMoeda: string | null
}

interface StoreState {
  jobs: Job[]
  candidates: Candidate[]
  loading: boolean
}

const INACTIVE_STATUSES = ['fechada', 'encerrada', 'arquivada', 'cancelada']

function mapDbStatus(dbStatus: string): CandidateStatus {
  const statusMap: Record<string, CandidateStatus> = {
    novo: 'novo',
    shortlist: 'shortlist',
    agendado: 'agendado',
    em_teste: 'em_teste',
    entrevistado: 'entrevistado',
    contratado: 'contratado',
    descartado: 'descartado',
    reprovado: 'reprovado',
    inativo: 'inativo',
  }
  return statusMap[dbStatus] || 'novo'
}

function mapJob(row: VagaRow, tenantName: string): Job {
  const rawAgentes = (row as Record<string, unknown>).agentes
  const agentes: string[] = Array.isArray(rawAgentes)
    ? rawAgentes.filter((a): a is string => typeof a === 'string')
    : ['assessor']
  return {
    id: row.id,
    title: row.titulo || '',
    company: row.empresa || '',
    description: row.descricao || '',
    requirements: row.descricao || '',
    active: !INACTIVE_STATUSES.includes(row.status),
    createdAt: row.criado_em || new Date().toISOString(),
    tenantId: row.tenant_id,
    tenantName,
    cargo: row.cargo || '',
    status: row.status || 'aberta',
    dataLimite: row.data_limite || null,
    codigo: row.codigo || null,
    agentes,
    janela: row.janela,
    etapas: row.etapas,
    maxAgendamentos: row.max_agendamentos,
    salarioMin: row.salario_min ?? null,
    salarioMax: row.salario_max ?? null,
    salarioMoeda: row.salario_moeda ?? 'BRL',
  }
}

function mapCandidate(row: CandidatoRow): Candidate {
  const score = row.score ?? 0
  return {
    id: row.id,
    jobId: row.vaga_id || '',
    tenantId: row.tenant_id,
    name: row.nome || '',
    role: row.cargo || '',
    email: row.email || '',
    phone: row.telefone || '',
    status: mapDbStatus(row.status || 'novo'),
    situacao: row.situacao === 'pausado' || row.situacao === 'eliminado' ? row.situacao : 'ativo',
    situacaoEm: row.situacao_em ?? null,
    motivoSaida: row.motivo_saida ?? null,
    faseSaida: row.fase_saida ?? null,
    etapaAtual: typeof row.etapa_atual === 'number' && row.etapa_atual > 0 ? row.etapa_atual : 1,
    shortlistOrdem: typeof row.shortlist_ordem === 'number' ? row.shortlist_ordem : null,
    score: { experiencia: score, tecnica: score, cultura: score, senioridade: score, total: score },
    avatarUrl: row.foto_url || null,
    matchReasons: row.score_obs ? [row.score_obs] : ['Análise automatizada pelo agente'],
    skills: [],
    history: [],
  }
}

let globalState: StoreState = { jobs: [], candidates: [], loading: true }
let isInitialized = false
const listeners = new Set<(state: StoreState) => void>()

async function initializeStore() {
  if (isInitialized) return
  isInitialized = true
  globalState = { ...globalState, loading: true }
  listeners.forEach((l) => l(globalState))

  try {
    await initActiveContext()

    const tenantId = getActiveTenantId()

    const tenantsRes = await supabase.from('tenants').select('id, nome')

    if (!tenantId) {
      globalState = { jobs: [], candidates: [], loading: false }
      listeners.forEach((l) => l(globalState))
      return
    }

    const [jobsRes, candRes] = await Promise.all([
      supabase.from('vagas').select('*').eq('tenant_id', tenantId),
      supabase.from('candidatos').select('*').eq('tenant_id', tenantId),
    ])

    const tenantMap = new Map<string, string>()
    for (const t of tenantsRes.data || []) tenantMap.set(t.id, t.nome || 'Sem nome')

    globalState = {
      jobs: (jobsRes.data || []).map((row) =>
        mapJob(row, tenantMap.get(row.tenant_id) || 'Desconhecido'),
      ),
      candidates: (candRes.data || []).map(mapCandidate),
      loading: false,
    }
  } catch {
    globalState = { jobs: [], candidates: [], loading: false }
  }
  listeners.forEach((l) => l(globalState))
}

async function reloadRecruitmentData() {
  isInitialized = false
  globalState = { ...globalState, loading: true }
  listeners.forEach((l) => l(globalState))
  await initializeStore()
}

function mutate(newState: Partial<StoreState>) {
  globalState = { ...globalState, ...newState }
  listeners.forEach((listener) => listener(globalState))
}

export default function useRecruitmentStore() {
  const [state, setState] = useState<StoreState>(globalState)

  useEffect(() => {
    listeners.add(setState)
    if (!isInitialized) initializeStore()
    return () => {
      listeners.delete(setState)
    }
  }, [])

  const updateCandidateStatus = async (id: string, status: CandidateStatus) => {
    const candidate = globalState.candidates.find((c) => c.id === id)
    if (!candidate) return
    const prevStatus = candidate.status

    const { error } = await supabase.from('candidatos').update({ status }).eq('id', id)
    if (error) {
      console.error('Failed to update candidate status:', error)
      return
    }

    await supabase.from('candidato_eventos').insert({
      candidato_id: id,
      tipo: 'mudanca_fase',
      de: prevStatus,
      para: status,
      agente: 'assessor',
      ator: 'operador_kanban',
      tenant_id: candidate.tenantId || null,
      vaga_id: candidate.jobId || null,
    })

    const candidates = globalState.candidates.map((c) =>
      c.id === id
        ? {
            ...c,
            status,
            history: [
              {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                type: 'system' as const,
                content: `Movido para ${status}`,
              },
              ...c.history,
            ],
          }
        : c,
    )
    mutate({ candidates })
  }

  return {
    ...state,
    reload: reloadRecruitmentData,
    addJob: (job: Job) => mutate({ jobs: [job, ...state.jobs] }),
    addCandidates: (newCandidates: Candidate[]) =>
      mutate({ candidates: [...newCandidates, ...state.candidates] }),
    updateCandidateStatus,
    updateJobInStore: (
      id: string,
      data: Partial<Pick<Job, 'janela' | 'maxAgendamentos' | 'dataLimite'>>,
    ) => {
      const jobs = globalState.jobs.map((j) => (j.id === id ? { ...j, ...data } : j))
      mutate({ jobs })
    },
    addInteraction: (candidateId: string, interaction: Omit<Interaction, 'id'>) => {
      const candidates = state.candidates.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              history: [{ id: Date.now().toString(), ...interaction } as Interaction, ...c.history],
            }
          : c,
      )
      mutate({ candidates })
    },
  }
}
