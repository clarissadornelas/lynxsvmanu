import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, ArrowRight, Settings, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Job, Candidate } from '@/stores/useRecruitmentStore'
import { getAvailabilityStatus } from '@/lib/job-availability-status'
import {
  KANBAN_COLUMNS,
  deriveKanbanColumn,
  parseEtapas,
  rotuloMotivoSaida,
  COR_FASE,
  type KanbanColumnId,
} from '@/lib/funnel-phases'

interface Props {
  job: Job
  candidates: Candidate[]
  onJobClick?: (jobId: string) => void
}

export function ExpandableJobCard({ job, candidates, onJobClick }: Props) {
  const [expanded, setExpanded] = useState(false)

  const totalRodadas = parseEtapas(job.etapas).length

  const colunaDe = (c: Candidate): KanbanColumnId =>
    deriveKanbanColumn(c.status, c.etapaAtual, totalRodadas, c.shortlistOrdem, c.faseSaida)

  const ativos = candidates.filter((c) => c.situacao !== 'eliminado')
  const saidos = candidates.filter((c) => c.situacao === 'eliminado')

  const colunaCounts: Record<string, number> = {}
  for (const c of ativos) {
    const col = colunaDe(c)
    colunaCounts[col] = (colunaCounts[col] || 0) + 1
  }
  const total = ativos.length || 1

  return (
    <Card className="border-slate-200">
      <div onClick={() => setExpanded(!expanded)} className="w-full text-left p-4 cursor-pointer">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span className="text-sm font-medium text-slate-700 truncate">{job.title}</span>
            <Badge variant="secondary" className="text-xs shrink-0">
              {job.tenantName}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                'text-xs shrink-0',
                job.status === 'aberta' && 'bg-emerald-50 text-emerald-700',
                job.status === 'pausada' && 'bg-amber-50 text-amber-700',
                job.status === 'fechada' && 'bg-slate-200 text-slate-600',
              )}
            >
              {job.status || 'aberta'}
            </Badge>
            {(() => {
              const avail = getAvailabilityStatus(job.janela, job.dataLimite)
              return (
                <Badge
                  variant="secondary"
                  className={cn('text-xs shrink-0 gap-1', avail.badgeClass)}
                  title={avail.label}
                >
                  <Clock className="w-3 h-3" />
                  {avail.label}
                </Badge>
              )
            })()}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400">{candidates.length} candidatos</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-slate-500"
              onClick={(e) => {
                e.stopPropagation()
                onJobClick?.(job.id)
              }}
            >
              <Settings className="w-3.5 h-3.5" />
              Configurar
            </Button>
            <Link to={`/vagas/${job.id}`} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-slate-500">
                Detalhes <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
          {KANBAN_COLUMNS.map((col) => {
            const count = colunaCounts[col.id] || 0
            if (count === 0) return null
            return (
              <div
                key={col.id}
                className="h-full transition-all"
                style={{
                  width: `${(count / total) * 100}%`,
                  backgroundColor: COR_FASE[col.id],
                }}
                title={`${col.label}: ${count}`}
              />
            )
          })}
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {KANBAN_COLUMNS.map((col) => {
            const colCandidates = ativos.filter((c) => colunaDe(c) === col.id)
            return (
              <div key={col.id}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COR_FASE[col.id] }}
                  />
                  <span className="text-sm font-medium text-slate-700">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {colCandidates.length}
                  </Badge>
                </div>
                {colCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 pl-5">Nenhum candidato</p>
                ) : (
                  <div className="space-y-1 pl-5">
                    {colCandidates.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={c.avatarUrl || undefined} alt={c.name} />
                            <AvatarFallback className="text-xs">
                              {c.name?.charAt(0)?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: COR_FASE[col.id] }}
                          />
                          <Link
                            to={`/dossie/${c.id}`}
                            className="text-sm font-medium text-slate-700 hover:text-indigo-600 truncate"
                          >
                            {c.name || 'Sem nome'}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-500">
                            {c.score.total.toFixed(1)}
                          </span>
                          <Link to={`/dossie/${c.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                              Ver perfil
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {saidos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="text-sm font-medium text-slate-500">Fora do processo</span>
                <Badge variant="secondary" className="text-xs">
                  {saidos.length}
                </Badge>
              </div>
              <div className="space-y-1 pl-5">
                {saidos.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 opacity-70"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={c.avatarUrl || undefined} alt={c.name} />
                        <AvatarFallback className="text-xs">
                          {c.name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <Link
                        to={`/dossie/${c.id}`}
                        className="text-sm font-medium text-slate-600 truncate hover:text-indigo-600"
                      >
                        {c.name || 'Sem nome'}
                      </Link>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {rotuloMotivoSaida(c.motivoSaida)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
