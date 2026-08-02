import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format, addDays, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Settings2, CalendarPlus, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { JobAvailabilitySection } from '@/components/job-availability/JobAvailabilitySection'
import { getAvailabilityStatus } from '@/lib/job-availability-status'
import { getBusySlots } from '@/lib/agenda/getBusySlots'
import { generateWeekSlots, type GeneratedSlot } from '@/lib/agenda/slot-generator'
import { parseJanela } from '@/components/job-availability/types'
import {
  FUNNEL_PHASES,
  phaseCount,
  KANBAN_COLUMNS,
  deriveKanbanColumn,
  parseEtapas,
  statusDaColuna,
  agruparPorRodada,
  recuoRodada,
  classesRodada,
  rotuloMotivoSaida,
  type KanbanColumnId,
} from '@/lib/funnel-phases'
import useRecruitmentStore, { Candidate, CandidateStatus } from '@/stores/useRecruitmentStore'
import type { Json } from '@/lib/supabase/types'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/avatar-utils'
import SaidaProcessoModal, { type MotivoSaida } from '@/components/kanban/SaidaProcessoModal'

const COLUMNS = KANBAN_COLUMNS.map((c) => ({
  id: c.id,
  label: c.label,
  tooltip: c.tooltip,
  color: 'bg-slate-100 text-slate-600',
}))

interface KanbanTabProps {
  candidates: Candidate[]
  jobId: string
  jobJanela?: Json | null
  jobDataLimite?: string | null
  jobMaxAgendamentos?: number
}

export default function KanbanTab({
  candidates,
  jobId,
  jobJanela,
  jobDataLimite,
  jobMaxAgendamentos,
}: KanbanTabProps) {
  const { updateCandidateStatus, updateJobInStore, reload, jobs } = useRecruitmentStore()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [localJanela, setLocalJanela] = useState<Json | null>(jobJanela ?? null)
  const [localDataLimite, setLocalDataLimite] = useState<string | null>(jobDataLimite ?? null)
  const [localMaxAgendamentos, setLocalMaxAgendamentos] = useState<number>(jobMaxAgendamentos ?? 3)
  const [schedulingCandidate, setSchedulingCandidate] = useState<Candidate | null>(null)
  const [availableSlots, setAvailableSlots] = useState<GeneratedSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [booking, setBooking] = useState(false)
  const [saidaCandidatoId, setSaidaCandidatoId] = useState<string | null>(null)
  const [saidasAbertas, setSaidasAbertas] = useState<Record<string, boolean>>({})
  const [ultimoEvento, setUltimoEvento] = useState<Record<string, string>>({})
  const [rodadaPendente, setRodadaPendente] = useState<Record<string, { entrevistaId: string }>>({})

  useEffect(() => {
    const ids = candidates.map((c) => c.id)
    if (ids.length === 0) {
      setUltimoEvento({})
      setRodadaPendente({})
      return
    }
    const load = async () => {
      const { data: eventos } = await supabase
        .from('candidato_eventos')
        .select('candidato_id, criado_em')
        .in('candidato_id', ids)
        .eq('vaga_id', jobId)
        .order('criado_em', { ascending: false })

      const mapa: Record<string, string> = {}
      for (const ev of eventos || []) {
        if (!mapa[ev.candidato_id]) {
          mapa[ev.candidato_id] = ev.criado_em
        }
      }
      setUltimoEvento(mapa)

      const { data: ents } = await supabase
        .from('entrevistas')
        .select('id, candidato_id, criado_em')
        .in('candidato_id', ids)
        .eq('vaga_id', jobId)
        .not('avaliada_em', 'is', null)
        .is('decisao', null)
        .order('criado_em', { ascending: false })

      const pendente: Record<string, { entrevistaId: string }> = {}
      for (const ent of ents || []) {
        pendente[ent.candidato_id] = { entrevistaId: ent.id }
      }
      setRodadaPendente(pendente)
    }
    load()
  }, [candidates, jobId])

  const saidaCandidato = saidaCandidatoId
    ? (candidates.find((c) => c.id === saidaCandidatoId) ?? null)
    : null

  const availability = getAvailabilityStatus(localJanela, localDataLimite)
  const currentJob = jobs.find((j) => j.id === jobId)
  const jobTitle = currentJob?.title || ''
  const totalRodadas = parseEtapas(currentJob?.etapas).length

  const colunaDoCandidato = (c: Candidate): KanbanColumnId =>
    deriveKanbanColumn(c.status, c.etapaAtual, totalRodadas, c.shortlistOrdem, c.faseSaida)

  const candidatosDaColuna = (colId: KanbanColumnId) =>
    candidates.filter((c) => c.situacao !== 'eliminado' && colunaDoCandidato(c) === colId)

  const eliminadosDaColuna = (colId: KanbanColumnId) =>
    candidates.filter((c) => c.situacao === 'eliminado' && colunaDoCandidato(c) === colId)

  const confirmarSaida = async (motivo: MotivoSaida) => {
    if (!saidaCandidatoId) return
    const c = candidates.find((cand) => cand.id === saidaCandidatoId)
    if (!c) {
      toast.error('Candidato nao encontrado na lista. Recarregue a pagina e tente de novo.')
      setSaidaCandidatoId(null)
      return
    }

    const { error: updErr } = await supabase
      .from('candidatos')
      .update({
        situacao: 'eliminado',
        motivo_saida: motivo,
        fase_saida: c.status,
        situacao_em: new Date().toISOString(),
      })
      .eq('id', c.id)

    if (updErr) {
      toast.error('Erro ao atualizar candidato. Tente novamente.')
      return
    }

    const { data: candData } = await supabase
      .from('candidatos')
      .select('nome, telefone, email, cargo, tenant_id')
      .eq('id', c.id)
      .single()

    if (candData?.telefone) {
      const { data: existingBase } = await supabase
        .from('base_ativa')
        .select('id')
        .eq('candidato_id', c.id)
        .maybeSingle()

      if (!existingBase) {
        const { error: baseErr } = await supabase.from('base_ativa').insert({
          candidato_id: c.id,
          tenant_id: candData.tenant_id,
          nome: candData.nome,
          telefone: candData.telefone,
          email: candData.email,
          ultimo_cargo: candData.cargo,
          origem: 'saida_processo',
          status_profissional: 'indefinido',
          abertura: 'indefinido',
          consentimento: false,
          opt_out: false,
          lead_quente: false,
          pings_enviados: 0,
          cadencia_dias: 30,
        })

        if (baseErr) {
          toast.warning(
            'Candidato saiu do processo, mas não foi possível adicioná-lo à Base Ativa.',
          )
        }
      }
    }

    const { error: evtErr } = await supabase.from('candidato_eventos').insert({
      candidato_id: c.id,
      vaga_id: jobId,
      tenant_id: c.tenantId,
      tipo: 'saida_processo',
      de: c.status,
      para: motivo,
      agente: null,
      ator: 'humano',
    })

    if (evtErr) {
      console.error(evtErr)
    }

    toast.success('Candidato removido do processo.')
    setSaidaCandidatoId(null)
    await reload()
  }

  const etapasDaVaga = parseEtapas(currentJob?.etapas)

  const diasAlerta =
    typeof currentJob?.dias_alerta === 'number' && currentJob.dias_alerta > 0
      ? currentJob.dias_alerta
      : 7

  const tempoParaExibir = (c: Candidate): string | null => {
    const referencia = ultimoEvento[c.id] || (c as { situacaoEm?: string | null }).situacaoEm
    if (!referencia) return null
    const dias = Math.floor((Date.now() - new Date(referencia).getTime()) / 86400000)
    if (isNaN(dias) || dias < diasAlerta) return null
    return `${dias} dias`
  }

  interface FaixaRodada {
    n: number
    nome: string
    indice: number
    vazia: boolean
  }

  interface ItemColuna {
    faixa: FaixaRodada | null
    candidato: Candidate | null
    indiceRodada: number | null
  }

  const itensDaColuna = (colId: KanbanColumnId): ItemColuna[] => {
    const daColuna = candidatosDaColuna(colId)

    if (colId !== 'em_entrevista') {
      return daColuna.map((c) => ({ faixa: null, candidato: c, indiceRodada: null }))
    }

    const grupos = agruparPorRodada(daColuna, etapasDaVaga)
    const itens: ItemColuna[] = []

    grupos.forEach((grupo, idx) => {
      itens.push({
        faixa: {
          n: grupo.n,
          nome: grupo.nome,
          indice: idx,
          vazia: grupo.itens.length === 0,
        },
        candidato: null,
        indiceRodada: idx,
      })
      grupo.itens.forEach((c) => {
        itens.push({ faixa: null, candidato: c, indiceRodada: idx })
      })
    })

    return itens
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const openSchedulingModal = async (candidate: Candidate) => {
    setSchedulingCandidate(candidate)
    setSelectedSlot(null)
    setAvailableSlots([])
    setLoadingSlots(true)

    const ws = startOfWeek(new Date(), { weekStartsOn: 1 })
    const days = Array.from({ length: 28 }).map((_, i) => addDays(ws, i))
    const busySlots = await getBusySlots(days[0], addDays(days[27], 1))

    const { data: agendData } = await supabase
      .from('agendamentos')
      .select('agendada_para')
      .eq('vaga_id', jobId)
      .in('status', ['agendada', 'confirmada'])
      .gte('agendada_para', days[0].toISOString())
      .lt('agendada_para', addDays(days[27], 1).toISOString())

    const dailyCounts: Record<string, number> = {}
    for (const a of agendData || []) {
      const dayStr = format(new Date(a.agendada_para), 'yyyy-MM-dd')
      dailyCounts[dayStr] = (dailyCounts[dayStr] || 0) + 1
    }

    const weekSlots = generateWeekSlots(
      days,
      localJanela,
      localDataLimite,
      localMaxAgendamentos,
      busySlots,
      dailyCounts,
    )
    const now = new Date()
    const freeSlots = weekSlots
      .flat()
      .filter((s) => !s.busy && !s.dayLimit && !s.expired && s.date > now)
    setAvailableSlots(freeSlots.slice(0, 20))
    setLoadingSlots(false)
  }

  const handleConfirmScheduling = async () => {
    if (!schedulingCandidate || !selectedSlot) return
    setBooking(true)
    try {
      const agendadaPara = selectedSlot.date.toISOString()
      const prevStatus = schedulingCandidate.status
      const duracaoMin = parseJanela(localJanela).duracao_min

      const { data: apt, error: aptErr } = await supabase
        .from('agendamentos')
        .insert({
          candidato_id: schedulingCandidate.id,
          vaga_id: jobId,
          tenant_id: schedulingCandidate.tenantId,
          agendada_para: agendadaPara,
          duracao: duracaoMin,
          status: 'agendada',
          etapa: 1,
        })
        .select('id')
        .single()
      if (aptErr) throw aptErr

      const { error: updErr } = await supabase
        .from('candidatos')
        .update({ status: 'agendado' })
        .eq('id', schedulingCandidate.id)
      if (updErr) throw updErr

      const { error: evtErr } = await supabase.from('candidato_eventos').insert({
        candidato_id: schedulingCandidate.id,
        vaga_id: jobId,
        tenant_id: schedulingCandidate.tenantId,
        tipo: 'mudanca_fase',
        de: prevStatus,
        para: 'agendado',
        agente: 'assessor',
        ator: 'kanban_agendamento_manual',
        payload: { agendamento_id: apt.id, agendada_para: agendadaPara },
      })
      if (evtErr) throw evtErr

      toast.success('Agendamento criado com sucesso!')
      await reload()
      setSchedulingCandidate(null)
      setSelectedSlot(null)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao agendar. Tente novamente.')
    } finally {
      setBooking(false)
    }
  }

  const handleDrop = async (e: React.DragEvent, status: CandidateStatus) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggedId
    setDraggedId(null)
    if (!id) return

    const candidate = candidates.find((c) => c.id === id)
    if (!candidate || candidate.status === status) return

    if (status === 'agendado') {
      const { data: existing } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('candidato_id', id)
        .eq('vaga_id', jobId)
        .in('status', ['agendada', 'confirmada'])

      if (!existing || existing.length === 0) {
        toast.error('Para mover para Agendado, escolha um horário primeiro.')
        openSchedulingModal(candidate)
        return
      }
    }

    updateCandidateStatus(id, status)
  }

  const handleAvailabilitySaved = (updated: {
    janela: Json | null
    maxAgendamentos: number
    dataLimite: string | null
  }) => {
    setLocalJanela(updated.janela)
    setLocalDataLimite(updated.dataLimite)
    setLocalMaxAgendamentos(updated.maxAgendamentos)
    updateJobInStore(jobId, {
      janela: updated.janela,
      maxAgendamentos: updated.maxAgendamentos,
      dataLimite: updated.dataLimite,
    })
    setAvailabilityOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-1 pb-3 flex-wrap">
        <Badge variant="secondary" className={cn('text-xs gap-1', availability.badgeClass)}>
          <Clock className="w-3 h-3" />
          {availability.label}
        </Badge>
        <div className="flex items-center gap-1.5">
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
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={() => setAvailabilityOpen(true)}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Configurar disponibilidade
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" asChild>
          <Link to={`/agenda?vaga=${jobId}`}>
            <Calendar className="w-3.5 h-3.5" />
            Abrir agenda da vaga
          </Link>
        </Button>
      </div>

      <div className="h-full flex gap-4 pb-4 px-1 min-w-max">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="w-80 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200/60 overflow-hidden shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => {
              const status = statusDaColuna(col.id)
              if (status) handleDrop(e, status as CandidateStatus)
            }}
          >
            <div className="p-3 border-b border-slate-200 bg-white/50 flex justify-between items-center">
              <h3 className="font-medium text-sm text-slate-700" title={col.tooltip}>
                {col.label}
              </h3>
              <Badge
                variant="secondary"
                className={cn('text-xs', col.color)}
                title="Ativos e pausados. Quem saiu do processo aparece no rodapé da coluna."
              >
                {candidatosDaColuna(col.id).length}
              </Badge>
            </div>

            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {itensDaColuna(col.id).map((item) => {
                const cores = item.faixa
                  ? classesRodada(item.faixa.indice, etapasDaVaga.length)
                  : null
                const c = item.candidato!
                return (
                  <div
                    key={item.faixa ? `faixa-${item.faixa.n}` : c.id}
                    style={
                      item.indiceRodada !== null
                        ? { marginLeft: recuoRodada(item.indiceRodada) }
                        : undefined
                    }
                  >
                    {item.faixa && cores && (
                      <div
                        style={{
                          borderLeft: `3px solid ${cores.borda}`,
                          background: cores.fundo,
                          color: cores.texto,
                        }}
                        className="px-3 py-1.5 text-xs font-medium mb-2"
                      >
                        {`F${item.faixa.n} ${item.faixa.nome}`}
                        {item.faixa.vazia && (
                          <span className="ml-2 text-[10px] opacity-60">vazia</span>
                        )}
                      </div>
                    )}
                    {c && (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, c.id)}
                        onDragEnd={() => setDraggedId(null)}
                        className={cn(
                          'bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-grab hover:border-indigo-300 drag-tilt',
                          draggedId === c.id ? 'opacity-50' : 'opacity-100',
                          c.situacao === 'pausado' &&
                            'border-l-[3px] border-l-orange-500 rounded-l-none',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage src={c.avatarUrl || undefined} alt={c.name} />
                            <AvatarFallback className="text-xs">
                              {getInitials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <Link
                                to={`/candidatos/${c.id}`}
                                className="font-medium text-sm text-slate-900 truncate hover:text-indigo-600 hover:underline"
                              >
                                {c.name}
                              </Link>
                              {(col.id === 'a_triar' || col.id === 'longlist') && (
                                <span
                                  className={cn(
                                    'text-xs font-bold px-1.5 rounded shrink-0',
                                    c.score.total >= 90
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : 'text-amber-700 bg-amber-50',
                                  )}
                                >
                                  {c.score.total}
                                </span>
                              )}
                            </div>
                            {c.situacao === 'pausado' ? (
                              <p className="text-xs mt-0.5 text-orange-600">pausado</p>
                            ) : (
                              tempoParaExibir(c) && (
                                <p className="text-xs mt-0.5 text-orange-600">
                                  {tempoParaExibir(c)}
                                </p>
                              )
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          {c.status === 'agendado' ? (
                            <span className="text-xs text-slate-500">agendado</span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openSchedulingModal(c)
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                            >
                              Agendar
                            </button>
                          )}
                          {c.situacao === 'eliminado' ? (
                            <span />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSaidaCandidatoId(c.id)
                              }}
                              className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                            >
                              Tirar do processo
                            </button>
                          )}
                        </div>
                        {rodadaPendente[c.id] && (
                          <Link
                            to={`/avaliar/${rodadaPendente[c.id].entrevistaId}`}
                            className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Analisar e decidir rodada
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {eliminadosDaColuna(col.id).length > 0 && (
              <div className="border-t border-slate-200">
                <button
                  className="w-full px-3 py-2 text-xs text-slate-400 flex items-center gap-1 hover:text-slate-600 transition-colors"
                  onClick={() => setSaidasAbertas((prev) => ({ ...prev, [col.id]: !prev[col.id] }))}
                >
                  <span className="text-[10px]">{saidasAbertas[col.id] ? '▾' : '▸'}</span>
                  {eliminadosDaColuna(col.id).length} fora do processo
                </button>
                {saidasAbertas[col.id] && (
                  <div className="px-2 pb-2 space-y-1.5">
                    {eliminadosDaColuna(col.id).map((c) => (
                      <div
                        key={c.id}
                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <Link
                          to={`/candidatos/${c.id}`}
                          className="block text-sm font-medium text-slate-900 truncate hover:text-indigo-600 hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {rotuloMotivoSaida((c as { motivoSaida?: string | null }).motivoSaida)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <SaidaProcessoModal
        open={saidaCandidato !== null}
        onOpenChange={(open) => {
          if (!open) setSaidaCandidatoId(null)
        }}
        nomeCandidato={saidaCandidato?.name ?? ''}
        permiteRecusouProposta={
          saidaCandidato !== null &&
          (colunaDoCandidato(saidaCandidato) === 'entrevistados' ||
            colunaDoCandidato(saidaCandidato) === 'shortlist_final')
        }
        onConfirmar={confirmarSaida}
      />

      <Sheet open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Disponibilidade da Vaga</SheetTitle>
            <SheetDescription className="sr-only">
              Configurar janelas de horário e disponibilidade
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 pt-4">
            {jobMaxAgendamentos !== undefined && (
              <JobAvailabilitySection
                jobId={jobId}
                initialJanela={localJanela}
                initialMaxAgendamentos={localMaxAgendamentos}
                initialDataLimite={localDataLimite}
                onSaved={handleAvailabilitySaved}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!schedulingCandidate}
        onOpenChange={(open) => {
          if (!open) setSchedulingCandidate(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Entrevista</DialogTitle>
            <DialogDescription>
              {schedulingCandidate?.name} · {jobTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingSlots ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-sm text-slate-500 mb-3">
                  Esta vaga ainda não tem horários disponíveis. Configure a disponibilidade ou abra
                  a Agenda.
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/agenda?vaga=${jobId}`}>Abrir Agenda</Link>
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[280px] rounded-md border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {availableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 transition-colors text-left',
                        selectedSlot === slot ? 'bg-blue-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-800 capitalize">
                          {format(slot.date, "d 'de' MMMM", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">
                          {format(slot.date, 'EEE', { locale: ptBR })}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{slot.time}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {availableSlots.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setSchedulingCandidate(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmScheduling}
                disabled={booking || !selectedSlot}
                className="bg-[#457B9D] hover:bg-[#3a6a88]"
              >
                {booking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  'Confirmar agendamento'
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
