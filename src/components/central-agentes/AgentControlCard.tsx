import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AGENT_LABELS } from '@/lib/agent-utils'

interface AgentControlCardProps {
  agentType: string
  ativo: boolean
  modo: string
  onToggle: (value: boolean) => void
  loading: boolean
  hasSwitch: boolean
  description?: string
  summary?: string
  isHired?: boolean
  papelAtivo?: string | null
  onHire?: () => void
}

export function AgentControlCard({
  agentType,
  ativo,
  modo,
  onToggle,
  loading,
  hasSwitch,
  description,
  summary,
  isHired = false,
  papelAtivo,
  onHire,
}: AgentControlCardProps) {
  const showHireState = hasSwitch && !isHired
  const isAdmin = papelAtivo === 'admin'

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              {AGENT_LABELS[agentType] || agentType}
            </p>
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link to={`/agentes/configuracoes?aba=${agentType}`}>
                <Settings2 className="w-4 h-4" />
              </Link>
            </Button>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : hasSwitch && isHired ? (
              <Switch checked={ativo} onCheckedChange={onToggle} />
            ) : null}
          </div>
        </div>
        {showHireState ? (
          isAdmin ? (
            <Button size="sm" className="w-full" onClick={onHire}>
              Contratar
            </Button>
          ) : (
            <p className="text-xs text-slate-400">Disponível pelo administrador da empresa</p>
          )
        ) : hasSwitch && isHired ? (
          <Badge variant={modo === 'real' ? 'default' : 'secondary'} className="text-xs">
            {modo === 'real' ? 'Real' : 'Ensaio'}
          </Badge>
        ) : null}
        {summary && <p className="text-xs text-slate-500">{summary}</p>}
      </CardContent>
    </Card>
  )
}
