import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  RefreshCw,
  User,
  Briefcase,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Ban,
  Globe,
  Unlock,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { BlockTimeModal } from '@/components/agenda/BlockTimeModal'
import { BookSlotModal } from '@/components/agenda/BookSlotModal'
import { ExternalAgendaManager } from '@/components/ExternalAgendaManager'
import { HolidayManager } from '@/components/HolidayManager'
import { parseJanela } from '@/components/job-availability/types'
import {
  fetchAgendasExternas,
  syncAgendaIcal,
  type AgendaExterna,
} from '@/services/agendas-externas'
import { getBusySlots, type BusySlot } from '@/lib/agenda/getBusySlots'
import { generateWeekSlots, countFreeSlots } from '@/lib/agenda/slot-generator'
import useRecruitmentStore from '@/stores/useRecruitmentStore'

type EventType = 'Entrevista' | 'Compromisso Pessoal' | 'Externo' | 'Livre'

interface CalendarEvent {
  id: string
  title: string
  type: EventType
  hour: number
  date: Date
  candidateName?: string
  roleName?: string
  meetLink?: string
  isPersonalBlock?: boolean
  blockId?: string
  isExternal?: boolean
  endDate?: Date
  candidatoId?: string
  vagaId?: string
  agendamentoStatus?: string
}

interface UpcomingAppointment {
  id: string
  agendada_para: string
  status: string
  candidateName: string
  jobTitle: string
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'confirmada':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'agendada':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'em_andamento':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'realizada':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'cancelada':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

const businessHours = [9, 10, 11, 12, 13, 14, 15, 16, 17]

function formatSyncLabel(dateStr: string | null): string {
  if (!dateStr) return 'Nunca sincronizada'
  const date = new Date(dateStr)
  const diff = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diff < 1) return 'Sincronizada agora'
  if (diff < 60) return `Sincronizada há ${diff} min`
  const hours = Math.floor(diff / 60)
  if (hours < 24) return `Sincronizada há ${hours}h`
  return `Sincronizada em ${format(date, 'dd/MM/yyyy')}`
}

export default function Agenda() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [bookSlotData, setBookSlotData] = useState<{
    date: Date
    time: string
    endDate: Date
  } | null>(null)
  const [referenceDate, setReferenceDate] = useState<Date>(new Date())
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [externalAgendas, setExternalAgendas] = useState<AgendaExterna[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(searchParams.get('vaga'))
  const [preselectedCandidateId, setPreselectedCandidateId] = useState<string | null>(
    searchParams.get('candidato'),
  )
  const [busySlots, setBusySlots] = useState<BusySlot[]>([])
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({})
  const [modalEntrevista, setModalEntrevista] = useState<any | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [markingRealizada, setMarkingRealizada] = useState(false)
  const navigate = useNavigate()

  const { tenantId: activeCtxTenantId } = useActiveContext()
  const { jobs: allJobs, reload: reloadRecruitment } = useRecruitmentStore()

  const today = new Date()
  const weekStart = useMemo(() => startOfWeek(referenceDate, { weekStartsOn: 1 }), [referenceDate])
  const days = useMemo(
    () => Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i)),
    [weekStart],
  )
  const weekEnd = days[4]

  const weekLabel = useMemo(() => {
    const startDay = format(weekStart, 'd')
    const endDay = format(weekEnd, 'd')
    const monthName = format(weekEnd, 'MMMM', { locale: ptBR })
    return `${startDay} a ${endDay} de ${monthName}`
  }, [weekStart, weekEnd])

  const isCurrentWeek = useMemo(() => {
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    return isSameDay(currentWeekStart, weekStart)
  }, [today, weekStart])

  const activeAgenda = externalAgendas[0] || null

  const availableJobs = useMemo(
    () => allJobs.filter((j) => j.active && j.janela !== null),
    [allJobs],
  )
  const selectedJob = useMemo(
    () => availableJobs.find((j) => j.id === selectedJobId) || null,
    [availableJobs, selectedJobId],
  )
  const selectedJobTitle = selectedJob?.title || ''
  const selectedJobDuracaoMin = useMemo(() => {
    if (!selectedJob) return 45
    return parseJanela(selectedJob.janela).duracao_min
  }, [selectedJob])

  const weekSlots = useMemo(() => {
    if (!selectedJob) return null
    return generateWeekSlots(
      days,
      selectedJob.janela,
      selectedJob.dataLimite,
      selectedJob.maxAgendamentos,
      busySlots,
      dailyCounts,
    )
  }, [selectedJob, days, busySlots, dailyCounts])

  const freeSlotsCount = useMemo(() => {
    if (!weekSlots) return 0
    return countFreeSlots(weekSlots)
  }, [weekSlots])

  useEffect(() => {
    setTenantId(activeCtxTenantId)
  }, [activeCtxTenantId])

  const loadExternalAgendas = useCallback(async () => {
    if (!tenantId) return
    const { data } = await fetchAgendasExternas(tenantId)
    if (data) setExternalAgendas(data.filter((a) => a.ativa))
  }, [tenantId])

  useEffect(() => {
    if (tenantId) loadExternalAgendas()
  }, [tenantId, loadExternalAgendas])

  const loadEvents = useCallback(async () => {
    try {
      const weekStartISO = weekStart.toISOString()
      const weekEndISO = addDays(weekEnd, 1).toISOString()

      const [agendRes, blocksRes, extRes] = await Promise.all([
        supabase
          .from('agendamentos')
          .select(
            `id, agendada_para, status, meet_link, candidato_id, vaga_id, candidatos ( nome ), vagas ( titulo )`,
          )
          .in('status', ['agendada', 'confirmada', 'em_andamento'])
          .gte('agendada_para', weekStartISO)
          .lt('agendada_para', weekEndISO),
        supabase
          .from('bloqueios_agenda')
          .select('id, titulo, inicio, fim')
          .gte('inicio', weekStartISO)
          .lt('inicio', weekEndISO),
        supabase
          .from('eventos_agenda_externa')
          .select('id, inicio, fim, titulo')
          .gte('inicio', weekStartISO)
          .lt('inicio', weekEndISO),
      ])

      const realEvents: CalendarEvent[] = (agendRes.data || []).map((a) => {
        const date = new Date(a.agendada_para)
        const cName = Array.isArray(a.candidatos) ? a.candidatos[0]?.nome : a.candidatos?.nome
        const vTitle = Array.isArray(a.vagas) ? a.vagas[0]?.titulo : a.vagas?.titulo
        return {
          id: a.id,
          title: `Entrevista - ${cName} - ${vTitle}`,
          type: 'Entrevista' as EventType,
          hour: date.getHours(),
          date,
          candidateName: cName || 'Candidato',
          roleName: vTitle || 'Vaga',
          meetLink: a.meet_link || undefined,
          candidatoId: a.candidato_id,
          vagaId: a.vaga_id,
          agendamentoStatus: a.status,
        }
      })

      const upcoming: UpcomingAppointment[] = (agendRes.data || [])
        .filter((a) => ['agendada', 'confirmada'].includes(a.status))
        .map((a) => {
          const cName = Array.isArray(a.candidatos) ? a.candidatos[0]?.nome : a.candidatos?.nome
          const vTitle = Array.isArray(a.vagas) ? a.vagas[0]?.titulo : a.vagas?.titulo
          return {
            id: a.id,
            agendada_para: a.agendada_para,
            status: a.status,
            candidateName: cName || 'Candidato',
            jobTitle: vTitle || 'Vaga',
          }
        })
        .sort((a, b) => new Date(a.agendada_para).getTime() - new Date(b.agendada_para).getTime())
      setUpcomingAppointments(upcoming)

      const blockEvents: CalendarEvent[] = (blocksRes.data || []).map((b) => {
        const startDate = new Date(b.inicio)
        return {
          id: b.id,
          title: b.titulo || 'Bloqueio',
          type: 'Compromisso Pessoal' as EventType,
          hour: startDate.getHours(),
          date: startDate,
          isPersonalBlock: true,
          blockId: b.id,
        }
      })

      const externalEvents: CalendarEvent[] = (extRes.data || []).map((e) => {
        const startDate = new Date(e.inicio)
        const endDate = new Date(e.fim)
        return {
          id: e.id,
          // PRIVACIDADE: evento de agenda externa nunca mostra assunto. So ocupado.
          title: 'Ocupado',
          type: 'Externo' as EventType,
          hour: startDate.getHours(),
          date: startDate,
          isExternal: true,
          endDate,
        }
      })

      setEvents([...realEvents, ...blockEvents, ...externalEvents])
    } catch (err) {
      console.error(err)
      setEvents([])
    }
  }, [weekStart, weekEnd, tenantId])

  useEffect(() => {
    loadEvents()
  }, [weekStart, tenantId])

  useEffect(() => {
    const vagaParam = searchParams.get('vaga')
    if (vagaParam !== selectedJobId) {
      setSelectedJobId(vagaParam)
    }
    const candidatoParam = searchParams.get('candidato')
    if (candidatoParam !== preselectedCandidateId) {
      setPreselectedCandidateId(candidatoParam)
    }
  }, [searchParams])

  useEffect(() => {
    const fetchBusy = async () => {
      const slots = await getBusySlots(weekStart, addDays(weekEnd, 1))
      setBusySlots(slots)
    }
    fetchBusy()
  }, [weekStart, weekEnd])

  useEffect(() => {
    if (!selectedJobId) {
      setDailyCounts({})
      return
    }
    const fetchCounts = async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('agendada_para')
        .eq('vaga_id', selectedJobId)
        .in('status', ['agendada', 'confirmada', 'em_andamento'])
        .gte('agendada_para', weekStart.toISOString())
        .lt('agendada_para', addDays(weekEnd, 1).toISOString())
      const counts: Record<string, number> = {}
      for (const a of data || []) {
        const dayStr = format(new Date(a.agendada_para), 'yyyy-MM-dd')
        counts[dayStr] = (counts[dayStr] || 0) + 1
      }
      setDailyCounts(counts)
    }
    fetchCounts()
  }, [selectedJobId, weekStart, weekEnd])

  const handleJobSelect = (jobId: string | null) => {
    setSelectedJobId(jobId)
    const newParams = new URLSearchParams(searchParams)
    if (jobId) {
      newParams.set('vaga', jobId)
    } else {
      newParams.delete('vaga')
    }
    setSearchParams(newParams, { replace: true })
  }

  const handleDataRefresh = useCallback(() => {
    loadEvents()
    getBusySlots(weekStart, addDays(weekEnd, 1)).then(setBusySlots)
  }, [loadEvents, weekStart, weekEnd])

  const handleFreeSlotClick = (slot: { date: Date; time: string; endDate: Date }) => {
    setBookSlotData(slot)
    setIsBookModalOpen(true)
  }

  const handleBooked = useCallback(() => {
    loadEvents()
    getBusySlots(weekStart, addDays(weekEnd, 1)).then(setBusySlots)
    if (selectedJobId) {
      supabase
        .from('agendamentos')
        .select('agendada_para')
        .eq('vaga_id', selectedJobId)
        .in('status', ['agendada', 'confirmada', 'em_andamento'])
        .gte('agendada_para', weekStart.toISOString())
        .lt('agendada_para', addDays(weekEnd, 1).toISOString())
        .then(({ data }) => {
          const counts: Record<string, number> = {}
          for (const a of data || []) {
            const dayStr = format(new Date(a.agendada_para), 'yyyy-MM-dd')
            counts[dayStr] = (counts[dayStr] || 0) + 1
          }
          setDailyCounts(counts)
        })
    }
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('candidato')
    setSearchParams(newParams, { replace: true })
    setPreselectedCandidateId(null)
    reloadRecruitment()
  }, [
    loadEvents,
    weekStart,
    weekEnd,
    selectedJobId,
    searchParams,
    setSearchParams,
    reloadRecruitment,
  ])

  const handleSync = async () => {
    if (!externalAgendas.length) return
    setIsSyncing(true)
    try {
      let totalSynced = 0
      let lastError: string | null = null
      for (const agenda of externalAgendas) {
        const { data, error } = await syncAgendaIcal(agenda.id)
        if (error) {
          lastError = error.message
        } else if (data?.error) {
          lastError = data.error
        } else {
          totalSynced += data?.events_synced ?? 0
        }
      }
      if (lastError && totalSynced === 0) {
        toast.error(`Erro na sincronização: ${lastError}`)
      } else {
        if (lastError) {
          toast.warning(`Sincronização parcial: ${totalSynced} evento(s) sincronizado(s).`)
        } else {
          toast.success(`Sincronização concluída! ${totalSynced} evento(s) sincronizado(s).`)
        }
        await loadExternalAgendas()
        await loadEvents()
        getBusySlots(weekStart, addDays(weekEnd, 1)).then(setBusySlots)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro inesperado na sincronização.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleEventClick = async (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsEventModalOpen(true)
    setModalEntrevista(null)
    if (event.type === 'Entrevista' && event.candidatoId && event.vagaId) {
      setModalLoading(true)
      try {
        let { data: entData } = await supabase
          .from('entrevistas')
          .select('*')
          .eq('agendamento_id', event.id)
          .maybeSingle()
        if (!entData) {
          const { data: entByPair } = await supabase
            .from('entrevistas')
            .select('*')
            .eq('candidato_id', event.candidatoId!)
            .eq('vaga_id', event.vagaId!)
            .maybeSingle()
          entData = entByPair
        }
        setModalEntrevista(entData)
      } catch (err) {
        console.error(err)
      }
      setModalLoading(false)
    }
  }

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlot({ date, hour })
    setIsBlockModalOpen(true)
  }

  const handleBlockTimeClick = () => {
    setSelectedSlot({ date: today, hour: 9 })
    setIsBlockModalOpen(true)
  }

  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase.from('bloqueios_agenda').delete().eq('id', blockId)
      if (error) throw error
      setEvents((prev) => prev.filter((e) => e.blockId !== blockId))
      setIsEventModalOpen(false)
      getBusySlots(weekStart, addDays(weekEnd, 1)).then(setBusySlots)
      toast.success('Bloqueio removido com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao remover bloqueio.')
    }
  }

  const isValidMeetingLink = (url?: string): boolean => {
    if (!url) return false
    return url.startsWith('http') && !url.toLowerCase().includes('mock')
  }

  const handleMarkRealizada = async () => {
    if (!selectedEvent || !selectedEvent.candidatoId || !selectedEvent.vagaId || !tenantId) return
    if (!window.confirm('Confirmar marcação desta entrevista como realizada?')) return
    setMarkingRealizada(true)
    try {
      let entrevistaId = modalEntrevista?.id

      if (modalEntrevista) {
        const updateData: Record<string, string> = { status: 'realizada' }
        if (!modalEntrevista.realizada_em) {
          updateData.realizada_em = new Date().toISOString()
        }
        const { error: entError } = await supabase
          .from('entrevistas')
          .update(updateData)
          .eq('id', modalEntrevista.id)
        if (entError) {
          toast.error(`Erro ao atualizar entrevista: ${entError.message}`)
          setMarkingRealizada(false)
          return
        }
      } else {
        const { data: newEnt, error: entError } = await supabase
          .from('entrevistas')
          .insert({
            tenant_id: tenantId,
            vaga_id: selectedEvent.vagaId,
            candidato_id: selectedEvent.candidatoId,
            agendamento_id: selectedEvent.id,
            status: 'realizada',
            realizada_em: new Date().toISOString(),
          })
          .select('id')
          .single()
        if (entError || !newEnt) {
          toast.error(`Erro ao criar entrevista: ${entError?.message}`)
          setMarkingRealizada(false)
          return
        }
        entrevistaId = newEnt.id
      }

      const { error: agendError } = await supabase
        .from('agendamentos')
        .update({ status: 'realizada' })
        .eq('candidato_id', selectedEvent.candidatoId)
        .eq('vaga_id', selectedEvent.vagaId)
        .in('status', ['agendada', 'confirmada', 'em_andamento'])
      if (agendError) {
        toast.error(`Erro ao atualizar agendamento: ${agendError.message}`)
        setMarkingRealizada(false)
        return
      }

      const { error: candError } = await supabase
        .from('candidatos')
        .update({ status: 'entrevistado' })
        .eq('id', selectedEvent.candidatoId)
      if (candError) {
        toast.error(`Erro ao atualizar candidato: ${candError.message}`)
        setMarkingRealizada(false)
        return
      }

      await supabase.from('candidato_eventos').insert({
        candidato_id: selectedEvent.candidatoId,
        vaga_id: selectedEvent.vagaId,
        tenant_id: tenantId,
        tipo: 'entrevista_realizada',
        ator: 'marcada_manual_agenda',
        agente: 'assessor',
        payload: { entrevista_id: entrevistaId, agendamento_id: selectedEvent.id },
      })

      toast.success('Entrevista marcada como realizada!')
      setIsEventModalOpen(false)
      loadEvents()
      getBusySlots(weekStart, addDays(weekEnd, 1)).then(setBusySlots)
      reloadRecruitment()
    } catch (err) {
      console.error(err)
      toast.error('Erro inesperado ao marcar entrevista.')
    }
    setMarkingRealizada(false)
  }

  const getEventForSlot = (date: Date, hour: number) => {
    return events.find((e) => isSameDay(e.date, date) && e.hour === hour)
  }

  const goToPreviousWeek = () => setReferenceDate((prev) => addDays(prev, -7))
  const goToNextWeek = () => setReferenceDate((prev) => addDays(prev, 7))
  const goToToday = () => setReferenceDate(new Date())

  const isEntrevistaRealizada =
    selectedEvent?.type === 'Entrevista' &&
    (selectedEvent.agendamentoStatus === 'realizada' ||
      (modalEntrevista && ['realizada', 'analisada', 'entregue'].includes(modalEntrevista.status)))

  if (!activeCtxTenantId) {
    return (
      <div className="p-8 text-center text-muted-foreground">Selecione um tenant em Contas</div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        subtitle="Seus horários, bloqueios e a agenda externa conectada via iCal."
      >
        {activeAgenda ? (
          <div className="flex items-center text-sm text-slate-500 mr-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            <span className="hidden sm:inline">
              {activeAgenda.rotulo || 'Agenda externa'} •{' '}
              {formatSyncLabel(activeAgenda.ultima_sincronizacao)}
            </span>
          </div>
        ) : (
          <Link
            to="/configuracoes"
            className="flex items-center text-sm text-amber-600 mr-2 hover:underline"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 mr-2" />
            <span className="hidden sm:inline">Nenhuma agenda externa conectada</span>
          </Link>
        )}
        <Button variant="outline" onClick={handleBlockTimeClick} className="bg-white">
          <Ban className="w-4 h-4 mr-2" />
          Bloquear horário
        </Button>
        {activeAgenda && (
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isSyncing && 'animate-spin')} />
            Sincronizar <span className="hidden sm:inline ml-1">agenda externa</span>
          </Button>
        )}
      </PageHeader>

      {availableJobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600 mr-1">Disponibilidade:</span>
          <button
            onClick={() => handleJobSelect(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
              !selectedJobId
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
            )}
          >
            Nenhuma
          </button>
          {availableJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => handleJobSelect(job.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all border max-w-[200px] truncate',
                selectedJobId === job.id
                  ? 'bg-[#457B9D] text-white border-[#457B9D]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#457B9D]/40',
              )}
            >
              {job.title}
            </button>
          ))}
          {selectedJob && (
            <Badge
              variant="outline"
              className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              {freeSlotsCount} {freeSlotsCount === 1 ? 'slot livre' : 'slots livres'} na semana
            </Badge>
          )}
        </div>
      )}

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-700">
            Próximos desta semana · {upcomingAppointments.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {upcomingAppointments.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Sem agendamentos nesta semana</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {upcomingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <div className="flex flex-col items-center justify-center min-w-[44px]">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      {format(new Date(apt.agendada_para), 'EEE', { locale: ptBR })}
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {format(new Date(apt.agendada_para), 'HH:mm')}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">{apt.candidateName}</span>
                    <span className="text-xs text-slate-500">{apt.jobTitle}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('text-xs border', getStatusBadgeClass(apt.status))}
                  >
                    {apt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 bg-slate-50/50 pb-4 gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <span>{weekLabel}</span>
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                onClick={goToPreviousWeek}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white"
                onClick={goToToday}
                disabled={isCurrentWeek}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                onClick={goToNextWeek}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {activeAgenda?.ultima_sincronizacao && (
              <>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Última sincronização:{' '}
                  {format(new Date(activeAgenda.ultima_sincronizacao), 'HH:mm')}
                </span>
                <Badge variant="outline" className="bg-white text-slate-600 border-slate-200">
                  {formatSyncLabel(activeAgenda.ultima_sincronizacao)}
                </Badge>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px] grid grid-cols-5 divide-x divide-slate-100">
            {days.map((day, i) => {
              const isToday = isSameDay(day, today)
              const daySlots = weekSlots?.[i] || null
              return (
                <div key={i} className={cn('min-h-[600px] bg-white', isToday && 'bg-blue-50/10')}>
                  <div
                    className={cn(
                      'text-center py-4 border-b border-slate-100',
                      isToday && 'bg-blue-50/40',
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm font-medium capitalize',
                        isToday ? 'text-blue-600' : 'text-slate-500',
                      )}
                    >
                      {format(day, 'EEEE', { locale: ptBR })}
                    </p>
                    <p
                      className={cn(
                        'text-2xl mt-1',
                        isToday ? 'text-blue-700 font-bold' : 'text-slate-900 font-medium',
                      )}
                    >
                      {format(day, 'd')}
                    </p>
                  </div>

                  <div className="flex flex-col divide-y divide-slate-50">
                    {businessHours.map((hour) => {
                      const event = getEventForSlot(day, hour)
                      if (event) {
                        const isInterview = event.type === 'Entrevista'
                        const isPersonal = event.isPersonalBlock
                        const isExternal = event.isExternal
                        return (
                          <div
                            key={hour}
                            className="h-24 p-2 cursor-pointer group"
                            onClick={() => handleEventClick(event)}
                          >
                            <div
                              className={cn(
                                'h-full w-full rounded-md border p-2 transition-all shadow-sm relative overflow-hidden',
                                isExternal
                                  ? 'bg-amber-50/60 border-amber-300 border-dashed hover:border-amber-400'
                                  : isPersonal
                                    ? 'bg-slate-200/60 border-slate-300 hover:border-slate-400'
                                    : 'bg-[#457B9D]/10 border-[#457B9D]/30 hover:border-[#457B9D]',
                              )}
                            >
                              <div
                                className={cn(
                                  'absolute left-0 top-0 bottom-0 w-1',
                                  isExternal
                                    ? 'bg-amber-500'
                                    : isPersonal
                                      ? 'bg-slate-500'
                                      : 'bg-[#457B9D]',
                                )}
                              />
                              <div className="flex items-center gap-1 mb-1">
                                {isExternal ? (
                                  <Globe className="w-3 h-3 text-amber-600" />
                                ) : (
                                  <Clock
                                    className={cn(
                                      'w-3 h-3',
                                      isPersonal ? 'text-slate-500' : 'text-[#457B9D]',
                                    )}
                                  />
                                )}
                                <span
                                  className={cn(
                                    'text-xs font-semibold',
                                    isExternal
                                      ? 'text-amber-700'
                                      : isPersonal
                                        ? 'text-slate-600'
                                        : 'text-[#457B9D]',
                                  )}
                                >
                                  {isExternal && event.endDate
                                    ? `${format(event.date, 'HH:mm')} - ${format(event.endDate, 'HH:mm')}`
                                    : `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2">
                                {event.title}
                              </p>
                              {isInterview && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                  <Video className="w-3 h-3" /> G. Meet
                                </div>
                              )}
                              {isPersonal && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                                  <Ban className="w-3 h-3" /> Bloqueado
                                </div>
                              )}
                              {isExternal && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                                  <Globe className="w-3 h-3" /> Externo
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }

                      if (daySlots) {
                        const hourSlots = daySlots.filter((s) => s.date.getHours() === hour)
                        if (hourSlots.length > 0) {
                          const dayAtLimit = hourSlots[0]?.dayLimit
                          if (dayAtLimit) {
                            return (
                              <div key={hour} className="h-24 p-2">
                                <div className="h-full w-full rounded-md border border-amber-200 bg-amber-50/40 flex items-center justify-center">
                                  <span className="text-xs text-amber-600 font-medium text-center px-2">
                                    Teto do dia atingido
                                  </span>
                                </div>
                              </div>
                            )
                          }
                          const freeHourSlots = hourSlots.filter((s) => !s.busy && !s.expired)
                          if (freeHourSlots.length > 0) {
                            return (
                              <div key={hour} className="h-24 p-2 space-y-1 overflow-hidden">
                                {freeHourSlots.map((slot, idx) => (
                                  <div
                                    key={idx}
                                    className="cursor-pointer rounded-md border border-emerald-300 bg-emerald-50/60 px-2 py-1 transition-all hover:border-emerald-400 hover:bg-emerald-100/60"
                                    onClick={() => handleFreeSlotClick(slot)}
                                  >
                                    <div className="flex items-center gap-1">
                                      <Unlock className="w-3 h-3 text-emerald-600" />
                                      <span className="text-xs font-semibold text-emerald-700">
                                        {slot.time}
                                      </span>
                                      <span className="text-xs text-emerald-600 font-medium ml-auto">
                                        Disponível
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-emerald-600/80 font-medium truncate">
                                      {selectedJobTitle}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        }
                      }

                      return (
                        <div
                          key={hour}
                          className="h-24 p-2 group cursor-pointer"
                          onClick={() => handleSlotClick(day, hour)}
                        >
                          <div className="h-full w-full rounded-md border border-dashed border-transparent hover:border-[#E8E8E8] hover:bg-[#E8E8E8]/30 flex flex-col justify-center items-center transition-all">
                            <span className="text-xs text-slate-300 font-medium group-hover:hidden">
                              {`${hour.toString().padStart(2, '0')}:00`}
                            </span>
                            <div className="hidden group-hover:flex items-center gap-1 text-xs text-slate-400 font-medium">
                              <Plus className="w-3 h-3" /> Bloquear
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                className={cn(
                  'text-white border-none shadow-none',
                  selectedEvent?.type === 'Entrevista'
                    ? 'bg-[#457B9D] hover:bg-[#457B9D]'
                    : selectedEvent?.isExternal
                      ? 'bg-amber-500 hover:bg-amber-500'
                      : 'bg-slate-500 hover:bg-slate-500',
                )}
              >
                {selectedEvent?.type}
              </Badge>
              {selectedEvent?.type === 'Entrevista' &&
                (selectedEvent.agendamentoStatus === 'realizada' ||
                  (modalEntrevista &&
                    ['realizada', 'analisada', 'entregue'].includes(modalEntrevista.status))) && (
                  <Badge className="bg-emerald-500 text-white border-none shadow-none">
                    Realizada
                    {modalEntrevista?.realizada_em &&
                      ` em ${format(new Date(modalEntrevista.realizada_em), 'dd/MM/yyyy HH:mm')}`}
                  </Badge>
                )}
            </div>
            <DialogTitle className="text-xl">{selectedEvent?.title}</DialogTitle>
            <DialogDescription>Detalhes do compromisso agendado.</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 text-slate-700">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Horário</p>
                <p className="text-sm text-slate-500 capitalize">
                  {selectedEvent?.date &&
                    format(selectedEvent.date, "EEEE, d 'de' MMMM", { locale: ptBR })}{' '}
                  •{' '}
                  {selectedEvent?.isExternal && selectedEvent?.endDate
                    ? `${format(selectedEvent.date, 'HH:mm')} - ${format(selectedEvent.endDate, 'HH:mm')}`
                    : `${selectedEvent?.hour.toString().padStart(2, '0')}:00 - ${(selectedEvent?.hour || 0) + 1}:00`}
                </p>
              </div>
            </div>

            {selectedEvent?.type === 'Entrevista' && (
              <>
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Candidato</p>
                    <p className="text-sm text-slate-500">{selectedEvent.candidateName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Vaga</p>
                    <p className="text-sm text-slate-500">{selectedEvent.roleName}</p>
                  </div>
                </div>
              </>
            )}

            {selectedEvent?.isExternal && (
              <div className="flex items-center gap-3 text-slate-700">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Origem</p>
                  <p className="text-sm text-slate-500">
                    Agenda externa (iCal) — evento somente leitura
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {selectedEvent?.isPersonalBlock && selectedEvent?.blockId && (
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => handleDeleteBlock(selectedEvent.blockId!)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover Bloqueio
              </Button>
            )}
            {selectedEvent?.type === 'Entrevista' && modalLoading && (
              <div className="flex items-center justify-center w-full py-2">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
            {selectedEvent?.type === 'Entrevista' && !modalLoading && isEntrevistaRealizada && (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!modalEntrevista}
                onClick={() => modalEntrevista && navigate(`/entrevistas/${modalEntrevista.id}`)}
              >
                Ver análise
              </Button>
            )}
            {selectedEvent?.type === 'Entrevista' && !modalLoading && !isEntrevistaRealizada && (
              <>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    if (modalEntrevista) {
                      navigate(`/entrevistas/${modalEntrevista.id}`)
                    } else if (selectedEvent?.vagaId && selectedEvent?.candidatoId) {
                      navigate(
                        `/entrevistas?vaga=${selectedEvent.vagaId}&candidato=${selectedEvent.candidatoId}`,
                      )
                    }
                  }}
                >
                  Preparar entrevista no Copiloto
                </Button>
                {isValidMeetingLink(selectedEvent?.meetLink) && (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      selectedEvent.meetLink && window.open(selectedEvent.meetLink, '_blank')
                    }
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Entrar na Reunião
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={markingRealizada}
                  onClick={handleMarkRealizada}
                >
                  {markingRealizada ? 'Marcando...' : 'Marcar como realizada'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookSlotModal
        open={isBookModalOpen}
        onOpenChange={setIsBookModalOpen}
        slotDate={bookSlotData?.date || null}
        slotTime={bookSlotData?.time || null}
        jobTitle={selectedJobTitle}
        jobId={selectedJobId}
        duracaoMin={selectedJobDuracaoMin}
        tenantId={tenantId}
        preselectedCandidateId={preselectedCandidateId}
        onBooked={handleBooked}
      />
      <BlockTimeModal
        open={isBlockModalOpen}
        onOpenChange={setIsBlockModalOpen}
        selectedSlot={selectedSlot}
        tenantId={tenantId}
        onSaved={handleDataRefresh}
      />

      {tenantId && (
        <div className="mt-6 space-y-6">
          <ExternalAgendaManager tenantId={tenantId} />
          <HolidayManager tenantId={tenantId} />
        </div>
      )}
    </div>
  )
}
