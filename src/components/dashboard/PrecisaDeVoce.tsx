import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { cn } from '@/lib/utils'

interface AlertItem {
  label: string
  navigateTo: string
  dotColor: string
}

const AGENT_ID_TO_TYPE: Record<string, string> = {
  '01': 'assessor',
  '02': 'copiloto',
  '03': 'base_ativa',
}

const AGENT_LABELS: Record<string, string> = {
  assessor: 'Meu Assessor',
  copiloto: 'Copiloto',
  base_ativa: 'Base Ativa',
}

export function PrecisaDeVoce() {
  const { user } = useAuth()
  const { tenantId } = useActiveContext()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAlerts() {
      if (!tenantId) {
        setLoading(false)
        return
      }

      const items: AlertItem[] = []

      const { data: acoes } = await supabase
        .from('acoes_agente')
        .select('status, tipo_acao, executada_em')
        .eq('tenant_id', tenantId)

      const pendingActions = (acoes ?? []).filter((a: any) => a.status === 'aguardando_humano')
      if (pendingActions.length > 0) {
        const hasResponder = pendingActions.some((a: any) => a.tipo_acao === 'responder_candidato')
        items.push({
          label: `${pendingActions.length} pendências dos agentes aguardando decisão`,
          navigateTo: '/agentes/central',
          dotColor: hasResponder ? 'bg-red-500' : 'bg-amber-500',
        })
      }

      if (user) {
        const { data: acesso } = await supabase
          .from('acesso_agentes')
          .select('agente_id')
          .eq('usuario_id', user.id)
          .eq('ativo', true)

        const { data: configs } = await supabase
          .from('configuracoes_agente')
          .select('agent_type, ativo')
          .eq('tenant_id', tenantId)

        const configMap: Record<string, boolean> = {}
        for (const c of (configs as any[]) ?? []) {
          if (c.agent_type) {
            configMap[c.agent_type] = c.ativo
          }
        }

        for (const a of (acesso as any[]) ?? []) {
          const agentType = AGENT_ID_TO_TYPE[a.agente_id]
          if (!agentType) continue
          if (configMap[agentType] === false) {
            items.push({
              label: `${AGENT_LABELS[agentType] || agentType} está pausado`,
              navigateTo: '/agentes/central',
              dotColor: 'bg-amber-500',
            })
          }
        }
      }

      const now = new Date()
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const failedActions = (acoes ?? []).filter(
        (a: any) =>
          a.status === 'falhou' && a.executada_em && new Date(a.executada_em) >= twentyFourHoursAgo,
      )
      if (failedActions.length > 0) {
        items.push({
          label: `${failedActions.length} ações de agente falharam`,
          navigateTo: '/agentes/central',
          dotColor: 'bg-red-500',
        })
      }

      const { data: vagas } = await supabase
        .from('vagas')
        .select('id, janela, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'aberta')

      const vagasSemJanela = (vagas ?? []).filter((v: any) => !v.janela)
      if (vagasSemJanela.length > 0) {
        items.push({
          label: `${vagasSemJanela.length} vagas sem janela de disponibilidade`,
          navigateTo: '/vagas',
          dotColor: 'bg-amber-500',
        })
      }

      const { data: entrevistas } = await supabase
        .from('entrevistas')
        .select('id, status, resumo')
        .eq('tenant_id', tenantId)
        .in('status', ['realizada', 'concluida'])

      const semAnalise = (entrevistas ?? []).filter((e: any) => !e.resumo)
      if (semAnalise.length > 0) {
        items.push({
          label: `${semAnalise.length} entrevistas sem análise`,
          navigateTo: '/entrevistas',
          dotColor: 'bg-amber-500',
        })
      }

      setAlerts(items)
      setLoading(false)
    }
    loadAlerts()
  }, [tenantId, user])

  if (loading) {
    return null
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-3">Precisa de você</h2>
      {alerts.length === 0 ? (
        <p className="text-sm text-slate-400">Tudo em dia.</p>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {alerts.map((alert, idx) => (
            <button
              key={idx}
              onClick={() => navigate(alert.navigateTo)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', alert.dotColor)} />
              <span className="text-sm text-slate-700 flex-1">{alert.label}</span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
