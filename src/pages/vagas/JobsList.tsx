import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, Clock, Info, Search, Archive } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getAvailabilityStatus } from '@/lib/job-availability-status'
import { FUNNEL_PHASES, phaseCount } from '@/lib/funnel-phases'
import type { Candidate } from '@/stores/useRecruitmentStore'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface ConversaRow {
  id: string
  estado: string
  pausada: boolean
  ultima_interacao: string
}

interface EventoRow {
  candidato_id: string
  criado_em: string
}

function isOlderThan24h(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > 24 * 60 * 60 * 1000
}

function isOlderThanDays(dateStr: string, days: number): boolean {
  return Date.now() - new Date(dateStr).getTime() > days * 24 * 60 * 60 * 1000
}

const ENCAMINHADA_ESTADOS = ['encerrada', 'recusada', 'opt_out']

function InfoIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Info className="w-3 h-3 text-slate-400 cursor-help" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">{text}</TooltipContent>
    </Tooltip>
  )
}

function FunnelPills({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {FUNNEL_PHASES.map((phase) => {
        const count = phaseCount(candidates, phase.id)
        return (
          <Tooltip key={phase.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
                  phase.badgeClass,
                  count === 0 && 'opacity-40',
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', phase.dotClass)} />
                {count}
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{phase.label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export default function JobsList() {
  const { jobs, candidates, loading } = useRecruitmentStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const empresaFilter = searchParams.get('empresa') || ''
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [conversas, setConversas] = useState<ConversaRow[]>([])
  const [shortlistEvents, setShortlistEvents] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convRes, evRes] = await Promise.all([
          supabase.from('conversas').select('id, estado, pausada, ultima_interacao'),
          supabase
            .from('candidato_eventos')
            .select('candidato_id, criado_em')
            .eq('tipo', 'mudanca_fase')
            .eq('para', 'shortlist')
            .order('criado_em', { ascending: false }),
        ])
        setConversas((convRes.data || []) as ConversaRow[])

        const evMap = new Map<string, string>()
        for (const ev of (evRes.data || []) as EventoRow[]) {
          if (!evMap.has(ev.candidato_id)) {
            evMap.set(ev.candidato_id, ev.criado_em)
          }
        }
        setShortlistEvents(evMap)
      } catch {
        toast.error('Erro ao carregar dados de conversas.')
      }
    }
    fetchData()
  }, [])

  const filteredJobs = jobs.filter(
    (j) =>
      (!search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.company.toLowerCase().includes(search.toLowerCase())) &&
      (!empresaFilter || j.company.toLowerCase() === empresaFilter.toLowerCase()) &&
      (showInactive || j.active),
  )
  const activeJobs = jobs.filter(
    (j) => j.active && (!empresaFilter || j.company.toLowerCase() === empresaFilter.toLowerCase()),
  ).length

  const convIniciadas = conversas.length
  const convEmAndamento = conversas.filter(
    (c) => c.estado === 'em_conversa' && !c.pausada && !isOlderThan24h(c.ultima_interacao),
  ).length
  const convRequeremAtencao = conversas.filter(
    (c) => c.pausada || (c.estado === 'em_conversa' && isOlderThan24h(c.ultima_interacao)),
  ).length
  const convAgendadas = conversas.filter((c) => c.estado === 'agendado').length
  const convEncerradas = conversas.filter((c) => ENCAMINHADA_ESTADOS.includes(c.estado)).length

  const stalledConvCandidateIds = useMemo(() => {
    return new Set(
      conversas
        .filter(
          (c) => c.pausada || (c.estado === 'em_conversa' && isOlderThan24h(c.ultima_interacao)),
        )
        .map((c) => c.id),
    )
  }, [conversas])

  const funnelInertiaCandidateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of candidates) {
      if (c.status === 'shortlist') {
        const refDate = shortlistEvents.get(c.id) || c.criado_em
        if (refDate && isOlderThanDays(refDate, 5)) {
          ids.add(c.id)
        }
      }
    }
    return ids
  }, [candidates, shortlistEvents])

  const allAttentionIds = useMemo(() => {
    return new Set([...stalledConvCandidateIds, ...funnelInertiaCandidateIds])
  }, [stalledConvCandidateIds, funnelInertiaCandidateIds])

  const attentionTotal = allAttentionIds.size
  const stalledConvCount = stalledConvCandidateIds.size
  const funnelInertiaCount = funnelInertiaCandidateIds.size

  const summaryCards = [
    {
      label: 'Vagas Ativas',
      value: activeJobs,
      color: 'text-emerald-600',
      tooltip: 'Número de vagas ativas no sistema. Fonte: tabela de vagas.',
    },
    ...FUNNEL_PHASES.map((phase) => ({
      label: phase.label,
      value: phaseCount(candidates, phase.id),
      color: phase.textClass,
      tooltip: phase.tooltip,
    })),
  ]

  const convCards = [
    {
      label: 'Iniciadas',
      value: convIniciadas,
      color: 'text-indigo-600',
      tooltip:
        'Conversas que já começaram. Fonte: tabela de conversas. Fica em zero enquanto o WhatsApp não estiver conectado.',
    },
    {
      label: 'Em andamento',
      value: convEmAndamento,
      color: 'text-emerald-600',
      tooltip: 'Conversas ativas com resposta nas últimas 24h. Fonte: tabela de conversas.',
    },
    {
      label: 'Requerem atenção',
      value: convRequeremAtencao,
      color: 'text-amber-600',
      tooltip:
        'Conversas pausadas ou sem resposta há mais de 24h, mais candidatos em shortlist parados há mais de 3 dias úteis. Fonte: conversas e eventos de mudança de fase.',
    },
    {
      label: 'Agendadas',
      value: convAgendadas,
      color: 'text-violet-600',
      tooltip: 'Conversas onde o agendamento foi concluído. Fonte: tabela de conversas.',
    },
    {
      label: 'Encerradas',
      value: convEncerradas,
      color: 'text-slate-600',
      tooltip: 'Conversas encerradas, recusadas ou opt-out. Fonte: tabela de conversas.',
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meu Assessor</h1>
            <p className="text-slate-500 mt-1">Carregando vagas...</p>
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-100 bg-white"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-48 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-5 w-8 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meu Assessor" subtitle="Gerencie suas vagas e acompanhe sua agenda.">
        <Button
          variant={showInactive ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
          className="text-xs"
        >
          <Archive className="w-3.5 h-3.5 mr-1.5" />
          {showInactive ? 'Ocultar inativas' : 'Mostrar inativas'}
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar vagas..."
            className="pl-9 w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link to="/agenda">
          <Button variant="outline" className="gap-2">
            <Clock className="w-4 h-4" />
            Minha Agenda
          </Button>
        </Link>
        <Link to="/vagas/nova">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Vaga
          </Button>
        </Link>
      </PageHeader>

      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-slate-500">Requerem atenção</p>
                  <InfoIcon
                    text={
                      'Conversas pausadas ou sem resposta há mais de 24h, mais candidatos em shortlist parados há mais de 3 dias úteis. Fonte: conversas e eventos de mudança de fase.'
                    }
                  />
                </div>
                <p className="text-3xl font-bold text-amber-700 mt-1">{attentionTotal}</p>
                <p className="text-xs text-amber-600 mt-1">
                  {stalledConvCount} em conversa travada · {funnelInertiaCount} parados no funil
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => navigate('/conversas')}
            >
              Ver detalhes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-3">
                <div className="flex items-start gap-1.5 min-h-[2.5rem]">
                  <p className="text-xs text-slate-500 leading-tight">{card.label}</p>
                  <InfoIcon text={card.tooltip} />
                </div>
                <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-3 mb-1">Conversas</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {convCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className="flex items-start gap-1.5 min-h-[2.5rem]">
                  <p className="text-xs text-slate-500 leading-tight">{card.label}</p>
                  <InfoIcon text={card.tooltip} />
                </div>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-slate-50 text-slate-500">
            Nenhuma vaga encontrada.
          </div>
        ) : (
          filteredJobs.map((job) => {
            const jobCandidates = candidates.filter((c) => c.jobId === job.id)
            const isEmpty = jobCandidates.length === 0
            const avail = getAvailabilityStatus(job.janela, job.dataLimite)
            return (
              <Link
                key={job.id}
                to={`/vagas/${job.id}`}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      isEmpty ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {isEmpty ? 'vazio' : 'iniciado'}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1',
                      avail.badgeClass,
                    )}
                  >
                    <Clock className="w-3 h-3" />
                    {avail.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{job.title}</p>
                    <p className="text-xs text-slate-400 truncate">{job.tenantName}</p>
                  </div>
                </div>
                <FunnelPills candidates={jobCandidates} />
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
