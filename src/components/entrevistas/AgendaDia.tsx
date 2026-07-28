import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgendaDiaProps {
  agendamentos: any[]
  candidatos: any[]
  vagas: any[]
  entrevistas: any[]
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return isSameDay(date, yesterday)
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return isSameDay(date, tomorrow)
}

function formatDateLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getBadgeLabel(
  entrevista: any | undefined,
  isPast: boolean,
): { label: string; className: string } {
  const realizadaStatuses = ['analisada', 'concluida', 'entregue']

  if (isPast) {
    if (entrevista && realizadaStatuses.includes(entrevista.status)) {
      return { label: 'realizada', className: 'bg-emerald-100 text-emerald-700' }
    }
    return { label: 'não realizada', className: 'bg-slate-200 text-slate-600' }
  }

  if (entrevista) {
    if (entrevista.status === 'roteiro_pronto') {
      return { label: 'roteiro pronto', className: 'bg-indigo-100 text-indigo-700' }
    }
    if (realizadaStatuses.includes(entrevista.status)) {
      return { label: 'realizada', className: 'bg-emerald-100 text-emerald-700' }
    }
  }

  return { label: 'aguardando roteiro', className: 'bg-amber-100 text-amber-700' }
}

export function AgendaDia({ agendamentos, candidatos, vagas, entrevistas }: AgendaDiaProps) {
  const navigate = useNavigate()
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(new Date())

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selectedDayCopy = new Date(diaSelecionado)
  selectedDayCopy.setHours(0, 0, 0, 0)
  const isPast = selectedDayCopy < today

  const dayInterviews = useMemo(() => {
    return agendamentos
      .filter((a) => {
        const aptDate = new Date(a.agendada_para)
        return isSameDay(aptDate, diaSelecionado)
      })
      .sort((a, b) => new Date(a.agendada_para).getTime() - new Date(b.agendada_para).getTime())
      .map((a) => {
        const cand = candidatos.find((c) => c.id === a.candidato_id)
        const vaga = vagas.find((v) => v.id === a.vaga_id)
        const ent = entrevistas.find(
          (e) => e.candidato_id === a.candidato_id && e.vaga_id === a.vaga_id,
        )
        return { agendamento: a, candidato: cand, vaga, entrevista: ent }
      })
  }, [agendamentos, candidatos, vagas, entrevistas, diaSelecionado])

  const dateLabel = useMemo(() => {
    const formatted = formatDateLabel(diaSelecionado)
    if (isToday(diaSelecionado)) return `Hoje · ${formatted}`
    if (isYesterday(diaSelecionado)) return `Ontem · ${formatted}`
    if (isTomorrow(diaSelecionado)) return `Amanhã · ${formatted}`
    return formatted
  }, [diaSelecionado])

  const shiftDay = (delta: number) => {
    const next = new Date(diaSelecionado)
    next.setDate(next.getDate() + delta)
    setDiaSelecionado(next)
  }

  const showHojeButton = !isToday(diaSelecionado)

  return (
    <Card className={cn('border-slate-200', isPast && 'opacity-60')}>
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Agenda de Entrevistas</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDay(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-slate-700 w-52 shrink-0 text-center tabular-nums">
              {dateLabel}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDay(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {showHojeButton && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setDiaSelecionado(new Date())}
              >
                Hoje
              </Button>
            )}
          </div>
        </div>
      </div>
      <CardContent className="p-0">
        {dayInterviews.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma entrevista neste dia.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dayInterviews.map(({ agendamento: a, candidato: cand, vaga, entrevista: ent }) => {
              const badge = getBadgeLabel(ent, isPast)
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-14 h-12 rounded-lg bg-indigo-50 flex flex-col items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-indigo-700">
                      {formatTime(a.agendada_para)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {cand?.nome || 'Candidato'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{vaga?.titulo || 'Vaga'}</p>
                  </div>
                  <Badge className={cn('text-xs shrink-0', badge.className)}>{badge.label}</Badge>
                  {!isPast && (
                    <Button
                      size="sm"
                      className="text-xs shrink-0"
                      onClick={() => {
                        if (ent?.id) {
                          navigate(`/entrevistas/${ent.id}`)
                        } else if (cand && vaga) {
                          navigate(`/entrevistas/nova?vaga=${vaga.id}&candidato=${cand.id}`)
                        }
                      }}
                    >
                      Abrir
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
