import { FUNNEL_PHASES } from '@/lib/funnel-phases'
import { STATUS_COLORS } from '@/lib/recruitment-constants'
import type { EventoData, CandidatoReportData } from '@/services/relatorios'

const PHASE_IDS = FUNNEL_PHASES.map((p) => p.id)

function getPhaseIndex(status: string): number {
  return PHASE_IDS.indexOf(status as (typeof PHASE_IDS)[number])
}

export interface KpiData {
  totalCandidates: number
  totalHires: number
  conversionRate: number
  avgTimeToHire: number | null
  smallSample: boolean
}

export interface FunnelPhaseData {
  phase: string
  label: string
  count: number
  color: string
  passThroughRate: number | null
}

export interface BottleneckPhaseData {
  phase: string
  label: string
  avgDays: number | null
  isBottleneck: boolean
}

export interface ReportMetrics {
  kpis: KpiData
  funnel: FunnelPhaseData[]
  bottleneck: BottleneckPhaseData[]
  hasData: boolean
}

export function computeReportMetrics(
  eventos: EventoData[],
  candidatos: CandidatoReportData[],
  daysWindow: number,
): ReportMetrics {
  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - daysWindow)

  const candidatoMap = new Map<string, CandidatoReportData>()
  for (const c of candidatos) candidatoMap.set(c.id, c)

  const candidateIdsInPeriod = new Set<string>()
  for (const e of eventos) {
    if (e.candidato_id) candidateIdsInPeriod.add(e.candidato_id)
  }
  for (const c of candidatos) {
    if (new Date(c.criado_em) >= windowStart) candidateIdsInPeriod.add(c.id)
  }

  if (eventos.length === 0) {
    return {
      kpis: {
        totalCandidates: 0,
        totalHires: 0,
        conversionRate: 0,
        avgTimeToHire: null,
        smallSample: false,
      },
      funnel: [],
      bottleneck: [],
      hasData: false,
    }
  }

  const totalCandidates = candidateIdsInPeriod.size
  const totalHires = eventos.filter((e) => e.para === 'contratado').length
  const conversionRate = totalCandidates > 0 ? (totalHires / totalCandidates) * 100 : 0
  const smallSample = totalCandidates < 10

  const hireEvents = eventos.filter((e) => e.para === 'contratado')
  let avgTimeToHire: number | null = null
  if (hireEvents.length > 0) {
    const times: number[] = []
    for (const ev of hireEvents) {
      const cand = candidatoMap.get(ev.candidato_id)
      if (cand) {
        const diff =
          (new Date(ev.criado_em).getTime() - new Date(cand.criado_em).getTime()) / 86400000
        if (diff >= 0) times.push(diff)
      }
    }
    if (times.length > 0) avgTimeToHire = times.reduce((a, b) => a + b, 0) / times.length
  }

  const eventsByCandidate = new Map<string, EventoData[]>()
  for (const e of eventos) {
    const arr = eventsByCandidate.get(e.candidato_id) || []
    arr.push(e)
    eventsByCandidate.set(e.candidato_id, arr)
  }

  const funnelCounts = PHASE_IDS.map(() => 0)
  for (const candId of candidateIdsInPeriod) {
    const cand = candidatoMap.get(candId)
    const currentStatusIdx = cand ? getPhaseIndex(cand.status) : -1
    const eventPhases = new Set<number>()
    for (const e of eventos) {
      if (e.candidato_id === candId && e.para) {
        const idx = getPhaseIndex(e.para)
        if (idx >= 0) eventPhases.add(idx)
      }
    }
    for (let i = 0; i < PHASE_IDS.length; i++) {
      if (eventPhases.has(i) || (currentStatusIdx >= 0 && currentStatusIdx >= i)) {
        funnelCounts[i]++
      }
    }
  }

  const funnel: FunnelPhaseData[] = PHASE_IDS.map((phase, i) => ({
    phase,
    label: FUNNEL_PHASES[i].label,
    count: funnelCounts[i],
    color: STATUS_COLORS[phase] || '#94a3b8',
    passThroughRate:
      i > 0 && funnelCounts[i - 1] > 0 ? (funnelCounts[i] / funnelCounts[i - 1]) * 100 : null,
  }))

  const bottleneck: BottleneckPhaseData[] = []
  for (let i = 0; i < PHASE_IDS.length - 1; i++) {
    const phase = PHASE_IDS[i]
    const nextPhase = PHASE_IDS[i + 1]
    const times: number[] = []
    for (const [, candEvents] of eventsByCandidate) {
      const entryEvent = candEvents.find((e) => e.para === phase)
      const exitEvent = candEvents.find((e) => e.para === nextPhase)
      if (entryEvent && exitEvent) {
        const diff =
          (new Date(exitEvent.criado_em).getTime() - new Date(entryEvent.criado_em).getTime()) /
          86400000
        if (diff >= 0) times.push(diff)
      }
    }
    const avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null
    bottleneck.push({ phase, label: FUNNEL_PHASES[i].label, avgDays, isBottleneck: false })
  }

  let maxIdx = -1
  let maxTime = -1
  for (let i = 0; i < bottleneck.length; i++) {
    if (bottleneck[i].avgDays !== null && bottleneck[i].avgDays! > maxTime) {
      maxTime = bottleneck[i].avgDays!
      maxIdx = i
    }
  }
  if (maxIdx >= 0) bottleneck[maxIdx].isBottleneck = true

  return {
    kpis: { totalCandidates, totalHires, conversionRate, avgTimeToHire, smallSample },
    funnel,
    bottleneck,
    hasData: true,
  }
}
