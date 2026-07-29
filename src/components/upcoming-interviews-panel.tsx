import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, ChevronRight, Clock, Video } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface UpcomingInterview {
  id: string
  agendadaPara: string
  candidatoNome: string
  vagaTitulo: string
  entrevistaId: string | null
  meetLink: string | null
  isRealizada: boolean
}

interface Props {
  agendamentos: any[]
  candidatos: any[]
  vagas: any[]
  entrevistas: any[]
}

function formatPtBR(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function UpcomingInterviewsPanel({ agendamentos, candidatos, vagas, entrevistas }: Props) {
  const navigate = useNavigate()

  const upcoming = useMemo<UpcomingInterview[]>(() => {
    const now = new Date()
    const realizedStatuses = ['realizada', 'analisada', 'entregue']
    return agendamentos
      .filter((a) => a.status === 'agendada' && new Date(a.agendada_para) > now)
      .sort((a, b) => new Date(a.agendada_para).getTime() - new Date(b.agendada_para).getTime())
      .slice(0, 8)
      .map((a) => {
        const cand = candidatos.find((c) => c.id === a.candidato_id)
        const vaga = vagas.find((v) => v.id === a.vaga_id)
        const ent = entrevistas.find(
          (e) => e.candidato_id === a.candidato_id && e.vaga_id === a.vaga_id,
        )
        const isRealizada = ent ? realizedStatuses.includes(ent.status) : false
        return {
          id: a.id,
          agendadaPara: a.agendada_para,
          candidatoNome: cand?.nome || 'Candidato',
          vagaTitulo: vaga?.titulo || 'Vaga',
          entrevistaId: ent?.id || null,
          meetLink: a.meet_link,
          isRealizada,
        }
      })
  }, [agendamentos, candidatos, vagas, entrevistas])

  if (upcoming.length === 0) return null

  return (
    <Card className="border-slate-200">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-slate-900">Próximas Entrevistas</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto">
              <Badge variant="secondary" className="text-xs cursor-default">
                {upcoming.filter((u) => !u.isRealizada).length}
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent>Entrevistas agendadas que ainda não foram realizadas</TooltipContent>
        </Tooltip>
      </div>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {upcoming.map((item) => (
            <button
              key={item.id}
              onClick={() => item.entrevistaId && navigate(`/entrevistas/${item.entrevistaId}`)}
              className={cn(
                'w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left',
                item.entrevistaId ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-plum-tenue flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{item.candidatoNome}</p>
                <p className="text-xs text-slate-500 truncate">{item.vagaTitulo}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-slate-700">
                  {formatPtBR(item.agendadaPara)}
                </p>
                {item.meetLink && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5 justify-end">
                    <Video className="w-3 h-3" /> Online
                  </p>
                )}
              </div>
              {item.isRealizada && (
                <Badge className="bg-emerald-100 text-emerald-700 text-xs shrink-0">
                  Realizada
                </Badge>
              )}
              {item.entrevistaId && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
