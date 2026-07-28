import { Badge } from '@/components/ui/badge'
import { Check, FlaskConical, AlertTriangle, X, HelpCircle } from 'lucide-react'
import { AGENT_LABELS, ACTION_LABELS, formatRelativeTimestamp } from '@/lib/agent-utils'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface RepetitionInfo {
  ordem: number
  total: number
  horas: number
}

interface HistoryItemProps {
  action: {
    id: string
    agent_type: string
    tipo_acao: string
    status: string
    motivo: string | null
    texto_composto: string | null
    resultado: string | null
    executada_em: string
    candidatos: { nome: string | null } | null
  }
  repetition?: RepetitionInfo | null
}

const STATUS_CONFIG: Record<string, { icon: LucideIcon; color: string }> = {
  concluida: { icon: Check, color: 'text-green-600' },
  simulada: { icon: FlaskConical, color: 'text-blue-600' },
  falhou: { icon: AlertTriangle, color: 'text-red-600' },
  cancelada: { icon: X, color: 'text-slate-400' },
}

export function HistoryItem({ action, repetition }: HistoryItemProps) {
  const config = STATUS_CONFIG[action.status] ?? { icon: AlertTriangle, color: 'text-slate-400' }
  const StatusIcon = config.icon
  const candidateName = action.candidatos?.nome ?? '—'
  const showRepetition = repetition && repetition.total >= 3

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-1">
      <div className="flex items-center gap-2">
        <StatusIcon className={cn('w-3.5 h-3.5 shrink-0', config.color)} />
        <Badge variant="outline" className="text-xs shrink-0">
          {AGENT_LABELS[action.agent_type] || action.agent_type}
        </Badge>
        <span className="text-xs text-slate-600 truncate">
          {ACTION_LABELS[action.tipo_acao] || action.tipo_acao}
        </span>
        <span className="text-sm text-slate-700 truncate">{candidateName}</span>
        <span className="text-xs text-slate-400 ml-auto shrink-0">
          {formatRelativeTimestamp(action.executada_em)}
        </span>
      </div>
      {showRepetition && (
        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
          {repetition!.ordem}ª vez em {repetition!.horas}h
        </Badge>
      )}
      {action.motivo && (
        <div className="flex items-start gap-1">
          <HelpCircle className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">{action.motivo}</p>
        </div>
      )}
      {action.texto_composto && (
        <p className="text-xs text-slate-600 truncate">&ldquo;{action.texto_composto}&rdquo;</p>
      )}
      {action.status === 'falhou' && action.resultado && (
        <p className="text-xs text-red-600 truncate">{action.resultado}</p>
      )}
    </div>
  )
}
