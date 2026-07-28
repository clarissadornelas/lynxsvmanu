import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Loader2, HelpCircle } from 'lucide-react'
import { AGENT_LABELS, ACTION_LABELS, formatRelativeTimestamp } from '@/lib/agent-utils'

interface RepetitionInfo {
  ordem: number
  total: number
  horas: number
}

interface ActionQueueItemProps {
  action: {
    id: string
    agent_type: string
    tipo_acao: string
    motivo_escalacao: string | null
    motivo: string | null
    candidato_id: string | null
    agendada_para: string
    criado_em: string
    candidatos: { nome: string | null } | null
  }
  variant: 'escalation' | 'upcoming'
  onResolve?: (id: string) => void
  onCancel: (id: string) => void
  loading?: boolean
  repetition?: RepetitionInfo | null
}

export function ActionQueueItem({
  action,
  variant,
  onResolve,
  onCancel,
  loading,
  repetition,
}: ActionQueueItemProps) {
  const candidateName = action.candidatos?.nome ?? '—'
  const showRepetition = repetition && repetition.total >= 3

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0">
            {AGENT_LABELS[action.agent_type] || action.agent_type}
          </Badge>
          <span className="text-xs text-slate-600 truncate">
            {ACTION_LABELS[action.tipo_acao] || action.tipo_acao}
          </span>
        </div>
        <p className="text-sm text-slate-700 truncate">{candidateName}</p>
        {action.motivo && (
          <div className="flex items-start gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">{action.motivo}</p>
          </div>
        )}
        {showRepetition && (
          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
            {repetition!.ordem}ª vez em {repetition!.horas}h
          </Badge>
        )}
        {variant === 'escalation' && action.motivo_escalacao && (
          <p className="text-xs text-amber-600 truncate">{action.motivo_escalacao}</p>
        )}
        {variant === 'upcoming' && (
          <p className="text-xs text-slate-400">{formatRelativeTimestamp(action.agendada_para)}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {variant === 'escalation' && onResolve && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            disabled={loading}
            onClick={() => onResolve(action.id)}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Resolvido
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-red-600 hover:text-red-700"
          disabled={loading}
          onClick={() => onCancel(action.id)}
        >
          <X className="w-3 h-3" /> Cancelar
        </Button>
      </div>
    </div>
  )
}
