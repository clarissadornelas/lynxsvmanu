import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, ArrowRight, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Job, Candidate } from '@/stores/useRecruitmentStore'
import { STATUS_COLORS, LANES, NEXT_STEPS } from '@/lib/recruitment-constants'
import { getAvailabilityStatus } from '@/lib/job-availability-status'
import { Clock } from 'lucide-react'

interface Props {
  job: Job
  candidates: Candidate[]
  onJobClick?: (jobId: string) => void
}

export function ExpandableJobCard({ job, candidates, onJobClick }: Props) {
  const [expanded, setExpanded] = useState(false)

  const statusCounts: Record<string, number> = {}
  for (const c of candidates) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
  }
  const total = candidates.length || 1
  const gateCount = candidates.filter((c) => c.status === 'agendado').length

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
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="h-full transition-all"
              style={{
                width: `${(count / total) * 100}%`,
                backgroundColor: STATUS_COLORS[status] || '#E2E8F0',
              }}
              title={`${status}: ${count}`}
            />
          ))}
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {LANES.map((lane, idx) => {
            const laneCandidates = candidates.filter((c) => lane.statuses.includes(c.status))
            return (
              <div key={lane.key}>
                {idx === 1 && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 border-t-2 border-dotted border-slate-300" />
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                      portão → Copiloto · {gateCount} pronto(s)
                    </span>
                    <div className="flex-1 border-t-2 border-dotted border-slate-300" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lane.color }} />
                  <span className="text-sm font-medium text-slate-700">{lane.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {laneCandidates.length}
                  </Badge>
                </div>
                {laneCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 pl-5">Nenhum candidato</p>
                ) : (
                  <div className="space-y-1 pl-5">
                    {laneCandidates.map((c) => (
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
                            style={{ backgroundColor: STATUS_COLORS[c.status] || '#E2E8F0' }}
                          />
                          <Link
                            to={`/candidatos/${c.id}`}
                            className="text-sm font-medium text-slate-700 hover:text-indigo-600 truncate"
                          >
                            {c.name || 'Sem nome'}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-500">
                            {c.score.total.toFixed(1)}
                          </span>
                          <Link to={`/candidatos/${c.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                              {NEXT_STEPS[c.status]}
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
        </CardContent>
      )}
    </Card>
  )
}
