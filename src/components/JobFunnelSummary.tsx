import type { Candidate } from '@/stores/useRecruitmentStore'
import {
  KANBAN_COLUMNS,
  deriveKanbanColumn,
  parseEtapas,
  COR_FASE,
  type KanbanColumnId,
} from '@/lib/funnel-phases'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface Props {
  candidates: Candidate[]
  etapas?: unknown
}

export function JobFunnelSummary({ candidates, etapas }: Props) {
  const totalRodadas = parseEtapas(etapas).length

  const ativos = candidates.filter((c) => c.situacao !== 'eliminado')
  const saidas = candidates.length - ativos.length

  const counts: Record<string, number> = {}
  for (const col of KANBAN_COLUMNS) {
    counts[col.id] = 0
  }
  for (const c of ativos) {
    const colId = deriveKanbanColumn(
      c.status,
      c.etapaAtual,
      totalRodadas,
      c.shortlistOrdem,
      c.faseSaida,
    )
    counts[colId] = (counts[colId] || 0) + 1
  }

  const total = ativos.length

  return (
    <div className="space-y-1.5">
      <div className="flex w-full h-3 rounded-full overflow-hidden bg-slate-100 gap-0.5">
        {KANBAN_COLUMNS.map((col) => {
          const count = counts[col.id] ?? 0
          const bg = count > 0 ? COR_FASE[col.id as KanbanColumnId] : '#F1EEEB'
          return (
            <Tooltip key={col.id}>
              <TooltipTrigger asChild>
                <div
                  className="h-full transition-all"
                  style={{
                    backgroundColor: bg,
                    flex: total > 0 ? Math.max(count, 0) : 1,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent className="text-xs">{`${col.label}: ${count}`}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex w-full gap-0.5">
        {KANBAN_COLUMNS.map((col) => {
          const count = counts[col.id] ?? 0
          return (
            <span
              key={col.id}
              className="text-[10px] leading-tight text-center text-slate-500"
              style={{ flex: total > 0 ? Math.max(count, 0) : 1 }}
            >
              {count > 0 ? count : ''}
            </span>
          )
        })}
      </div>
      <p className="text-xs text-slate-500">
        {`${ativos.length} ativos`}
        {saidas > 0 ? ` · ${saidas} fora do processo, fora da conta` : ''}
      </p>
    </div>
  )
}
