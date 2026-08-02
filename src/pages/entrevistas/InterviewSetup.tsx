import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Video, Clock, ChevronRight, Calendar } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { COPILOT_STAGES, deriveCopilotStage } from '@/lib/funnel-phases'
import { getInitials } from '@/lib/avatar-utils'
import type { CopilotStage } from '@/lib/funnel-phases'
import { AgendaDia } from '@/components/entrevistas/AgendaDia'

function getScoreColor(score: number | null): string {
  if (!score) return '#94a3b8'
  if (score <= 40) return '#E63946'
  if (score <= 60) return '#F77F00'
  if (score <= 80) return '#FDB833'
  return '#06A77D'
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ]
  return `${day} ${months[date.getMonth()]}`
}

interface ParecerPendente {
  id: string
  candidato_nome: string
  avaliada_em: string | null
}

export default function InterviewSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { tenantId } = useActiveContext()
  const [loading, setLoading] = useState(true)
  const [vagas, setVagas] = useState<any[]>([])
  const [entrevistas, setEntrevistas] = useState<any[]>([])
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [candidatos, setCandidatos] = useState<any[]>([])
  const [selectedVagaId, setSelectedVagaId] = useState<string | null>(null)
  const [showFullPool, setShowFullPool] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [preselectedCandidatoId, setPreselectedCandidatoId] = useState<string | null>(null)
  const [filaAvaliar, setFilaAvaliar] = useState<ParecerPendente[]>([])
  const [filaParecer, setFilaParecer] = useState<ParecerPendente[]>([])

  useEffect(() => {
    if (!tenantId) return
    async function load() {
      setLoading(true)
      const [vagasRes, entRes, agRes, candRes] = await Promise.all([
        supabase
          .from('vagas')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('criado_em', { ascending: false }),
        supabase.from('entrevistas').select('*').eq('tenant_id', tenantId),
        supabase
          .from('agendamentos')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('agendada_para', { ascending: true })
          .limit(50),
        supabase
          .from('candidatos')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('score', { ascending: false }),
      ])
      setVagas(vagasRes.data || [])
      setEntrevistas(entRes.data || [])
      setAgendamentos(agRes.data || [])
      setCandidatos(candRes.data || [])
      setLoading(false)
    }
    load()
  }, [tenantId])

  useEffect(() => {
    const queryVaga = searchParams.get('vaga')
    const queryCandidato = searchParams.get('candidato')
    if (queryVaga && vagas.length > 0 && !selectedVagaId) {
      setSelectedVagaId(queryVaga)
    } else if (!selectedVagaId && vagas.length > 0) {
      setSelectedVagaId(vagas[0].id)
    }
    if (queryCandidato) {
      setPreselectedCandidatoId(queryCandidato)
      setShowFullPool(true)
    }
  }, [vagas, selectedVagaId, searchParams])

  useEffect(() => {
    if (!tenantId) return
    async function loadPareceres() {
      const { data: ents } = await supabase
        .from('entrevistas')
        .select('id, candidato_id, avaliada_em, status')
        .eq('tenant_id', tenantId)
        .not('realizada_em', 'is', null)
        .order('criado_em', { ascending: false })
        .limit(30)

      if (!ents || ents.length === 0) {
        setFilaAvaliar([])
        setFilaParecer([])
        return
      }

      const candIds = [...new Set(ents.map((e) => e.candidato_id))]
      const { data: cands } = await supabase.from('candidatos').select('id, nome').in('id', candIds)

      const candMap = new Map<string, string>()
      cands?.forEach((c) => candMap.set(c.id, c.nome || 'Candidato'))

      const avaliar: ParecerPendente[] = []
      const parecer: ParecerPendente[] = []

      for (const ent of ents) {
        const item: ParecerPendente = {
          id: ent.id,
          candidato_nome: candMap.get(ent.candidato_id) || 'Candidato',
          avaliada_em: ent.avaliada_em,
        }
        if (!ent.avaliada_em) {
          avaliar.push(item)
        } else if (ent.status !== 'analisada' && ent.status !== 'entregue') {
          parecer.push(item)
        }
      }

      setFilaAvaliar(avaliar.slice(0, 5))
      setFilaParecer(parecer.slice(0, 5))
    }
    loadPareceres()
  }, [tenantId])

  const rodadaDoCandidato = (candId: string): number => {
    const c = candidatos.find((x) => x.id === candId)
    const n = c?.etapa_atual
    return typeof n === 'number' && n > 0 ? n : 1
  }

  const entrevistaDaRodada = (candId: string, vagaId: string) =>
    entrevistas.find(
      (e) =>
        e.candidato_id === candId &&
        e.vaga_id === vagaId &&
        (e.rodada ?? 1) === rodadaDoCandidato(candId),
    )

  const proximasEntrevistas = useMemo(() => {
    return agendamentos
      .filter((a) => ['agendada', 'confirmada'].includes(a.status))
      .sort((a, b) => new Date(a.agendada_para).getTime() - new Date(b.agendada_para).getTime())
      .map((a) => {
        const cand = candidatos.find((c) => c.id === a.candidato_id)
        const vaga = vagas.find((v) => v.id === a.vaga_id)
        const ent = entrevistaDaRodada(a.candidato_id, a.vaga_id)
        return { agendamento: a, candidato: cand, vaga, entrevista: ent }
      })
  }, [agendamentos, candidatos, vagas, entrevistas])

  const pipelineCounts = useMemo(() => {
    const counts: Record<CopilotStage['id'], number> = {
      a_preparar: 0,
      pronta: 0,
      a_analisar: 0,
      analisada: 0,
    }
    for (const cand of candidatos) {
      const ent = entrevistas.find(
        (e) => e.candidato_id === cand.id && (e.rodada ?? 1) === rodadaDoCandidato(cand.id),
      )
      const apt = agendamentos.find((a) => a.candidato_id === cand.id && a.status === 'agendada')
      const stage = deriveCopilotStage(ent, apt)
      counts[stage]++
    }
    return counts
  }, [candidatos, entrevistas, agendamentos])

  const jobStageCounts = useMemo(() => {
    const stats: Record<string, Record<CopilotStage['id'], number>> = {}
    for (const vaga of vagas) {
      const vagaCands = candidatos.filter((c) => c.vaga_id === vaga.id)
      const stageCounts: Record<CopilotStage['id'], number> = {
        a_preparar: 0,
        pronta: 0,
        a_analisar: 0,
        analisada: 0,
      }
      for (const cand of vagaCands) {
        const ent = entrevistaDaRodada(cand.id, vaga.id)
        const apt = agendamentos.find(
          (a) => a.candidato_id === cand.id && a.vaga_id === vaga.id && a.status === 'agendada',
        )
        const stage = deriveCopilotStage(ent, apt)
        stageCounts[stage]++
      }
      stats[vaga.id] = stageCounts
    }
    return stats
  }, [vagas, candidatos, entrevistas, agendamentos])

  const rankedCandidates = useMemo(() => {
    if (!selectedVagaId) return []
    let pool = candidatos.filter((c) => c.vaga_id === selectedVagaId)
    if (!showFullPool) {
      pool = pool.filter((c) => {
        const ent = entrevistaDaRodada(c.id, selectedVagaId)
        const apt = agendamentos.find(
          (a) => a.candidato_id === c.id && a.vaga_id === selectedVagaId && a.status === 'agendada',
        )
        return !!ent || !!apt
      })
    }
    return pool.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20)
  }, [candidatos, selectedVagaId, showFullPool, entrevistas, agendamentos])

  const handleAction = async (candId: string, vagaId: string) => {
    setActionLoading(candId)
    try {
      const existing = entrevistaDaRodada(candId, vagaId)
      if (existing) {
        navigate(`/entrevistas/${existing.id}`)
        return
      }
      const vaga = vagas.find((v) => v.id === vagaId)
      if (!vaga) return
      const { data: newEnt, error } = await supabase
        .from('entrevistas')
        .insert({
          tenant_id: vaga.tenant_id,
          vaga_id: vagaId,
          candidato_id: candId,
          rodada: rodadaDoCandidato(candId),
          status: 'aguardando',
        })
        .select('id')
        .single()
      if (error || !newEnt) {
        toast.error('Erro ao criar entrevista')
        return
      }
      navigate(`/entrevistas/${newEnt.id}`)
    } catch {
      toast.error('Erro ao processar ação')
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 pb-8">
        <PageHeader
          title="Copiloto de Entrevistas"
          subtitle="Prepare, conduza e analise entrevistas com apoio de IA."
        >
          <Button variant="outline" size="sm" asChild>
            <Link to="/agenda">
              <Calendar className="w-4 h-4 mr-2" />
              Ver agenda
            </Link>
          </Button>
        </PageHeader>

        <AgendaDia
          agendamentos={agendamentos}
          candidatos={candidatos}
          vagas={vagas}
          entrevistas={entrevistas}
        />

        {/* Próximas entrevistas */}
        <Card className="border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Video className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Próximas entrevistas</h2>
          </div>
          <CardContent className="p-0">
            {proximasEntrevistas.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhuma entrevista agendada.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {proximasEntrevistas.map(
                  ({ agendamento: a, candidato: cand, vaga, entrevista: ent }) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center w-14 shrink-0">
                        <span className="text-xs font-medium text-slate-500">
                          {formatShortDate(a.agendada_para)}
                        </span>
                        <span className="text-sm font-bold text-primary">
                          {formatTime(a.agendada_para)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {cand?.nome || 'Candidato'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{vaga?.titulo || 'Vaga'}</p>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs shrink-0"
                        disabled={actionLoading === a.candidato_id}
                        onClick={() => {
                          if (ent) {
                            navigate(`/entrevistas/${ent.id}`)
                          } else {
                            handleAction(a.candidato_id, a.vaga_id)
                          }
                        }}
                      >
                        {actionLoading === a.candidato_id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Video className="w-3 h-3 mr-1" />
                        )}
                        Abrir sala
                      </Button>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pareceres pendentes */}
        {filaAvaliar.length > 0 || filaParecer.length > 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Pareceres pendentes</p>
              {filaAvaliar.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900 truncate">{item.candidato_nome}</p>
                    <p className="text-xs text-amber-700">
                      Entrevista realizada, aguardando sua avaliação
                    </p>
                  </div>
                  <Link
                    to={`/avaliar/${item.id}`}
                    className="text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md px-3 py-1 shrink-0"
                  >
                    Avaliar
                  </Link>
                </div>
              ))}
              {filaParecer.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900 truncate">{item.candidato_nome}</p>
                    <p className="text-xs text-slate-500">Avaliada, aguardando parecer da IA</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Estágios do Copiloto */}
        <div className="flex flex-wrap items-center gap-2">
          {COPILOT_STAGES.map((stage) => (
            <Tooltip key={stage.id}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 cursor-help">
                  <span className={cn('w-2 h-2 rounded-full', stage.dotClass)} />
                  <span className="text-xs font-medium text-slate-600">{stage.label}</span>
                  <span className={cn('text-xs font-semibold tabular-nums', stage.textClass)}>
                    {pipelineCounts[stage.id]}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold">{stage.label}</p>
                <p className="text-xs">{stage.hint}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Job List */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
            Vagas Ativas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vagas
              .filter((v) => v.status === 'aberta')
              .map((vaga) => {
                const stages = jobStageCounts[vaga.id] || {
                  a_preparar: 0,
                  pronta: 0,
                  a_analisar: 0,
                  analisada: 0,
                }
                const isSelected = selectedVagaId === vaga.id
                return (
                  <Card
                    key={vaga.id}
                    className={cn(
                      'cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary ring-2 ring-indigo-100'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div className="p-4" onClick={() => setSelectedVagaId(vaga.id)}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-slate-900 truncate">{vaga.titulo}</h3>
                          <p className="text-xs text-slate-500 truncate">
                            {vaga.empresa || 'Sem empresa'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {COPILOT_STAGES.map((stage) => (
                          <Tooltip key={stage.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-help',
                                  stages[stage.id] === 0 && 'opacity-40',
                                )}
                              >
                                <span className={cn('w-2 h-2 rounded-full', stage.dotClass)} />
                                <span className="font-medium text-slate-600">
                                  {stages[stage.id]}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-semibold">{stage.label}</p>
                              <p className="text-xs">{stage.hint}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                      {stages.analisada >= 1 && (
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/vagas/${vaga.id}?tab=decisao`)
                          }}
                        >
                          Comparar e decidir ({stages.analisada})
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
          </div>
        </div>

        {/* Candidate Pool */}
        {selectedVagaId && (
          <Card className="border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Candidatos - {vagas.find((v) => v.id === selectedVagaId)?.titulo}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={!showFullPool ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFullPool(false)}
                  className="text-xs"
                >
                  No Copiloto
                </Button>
                <Button
                  variant={showFullPool ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFullPool(true)}
                  className="text-xs"
                >
                  Pool Completo
                </Button>
              </div>
            </div>
            <CardContent className="p-0">
              {rankedCandidates.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Nenhum candidato encontrado neste filtro.
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="divide-y divide-slate-100">
                    {rankedCandidates.map((cand, idx) => {
                      const ent = entrevistaDaRodada(cand.id, selectedVagaId)
                      const apt = agendamentos.find(
                        (a) =>
                          a.candidato_id === cand.id &&
                          a.vaga_id === selectedVagaId &&
                          a.status === 'agendada',
                      )
                      const stage = deriveCopilotStage(ent, apt)
                      const stageInfo = COPILOT_STAGES.find((s) => s.id === stage)!
                      const scoreColor = getScoreColor(cand.score)

                      let buttonLabel = ''
                      if (stage === 'a_preparar') buttonLabel = 'Gerar preparação'
                      else if (stage === 'pronta') buttonLabel = 'Abrir sala'
                      else if (stage === 'a_analisar') buttonLabel = 'Colar transcrição'
                      else if (stage === 'analisada') buttonLabel = 'Ver análise'

                      return (
                        <div
                          key={cand.id}
                          className={cn(
                            'flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors',
                            preselectedCandidatoId === cand.id &&
                              'bg-plum-tenue ring-1 ring-indigo-200',
                          )}
                        >
                          <span className="text-sm font-bold text-slate-400 w-6 text-center shrink-0">
                            #{idx + 1}
                          </span>
                          <Avatar className="w-9 h-9 shrink-0 bg-muted">
                            <AvatarImage src={(cand as any).foto_url || undefined} />
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                              {getInitials(cand.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{cand.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge
                                variant="outline"
                                className="text-xs font-bold border-none"
                                style={{ backgroundColor: scoreColor, color: 'white' }}
                              >
                                {cand.score ? `${cand.score}%` : 'N/A'}
                              </Badge>
                              <Badge className={cn('text-xs', stageInfo.badgeClass)}>
                                {stageInfo.label}
                              </Badge>
                              {stage === 'pronta' && apt && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(apt.agendada_para)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={actionLoading === cand.id}
                            onClick={() => {
                              if (ent) {
                                navigate(`/entrevistas/${ent.id}`)
                              } else {
                                handleAction(cand.id, selectedVagaId)
                              }
                            }}
                            className="text-xs shrink-0"
                          >
                            {actionLoading === cand.id && (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            )}
                            {buttonLabel}
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}
