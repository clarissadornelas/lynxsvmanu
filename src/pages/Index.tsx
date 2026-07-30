import { useState, useEffect } from 'react'
import { ClipboardList, Mic, Target, ArrowRight, Loader2, Settings2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { AGENTES, agenteContratado, CTA_CONTRATAR_SEM_PERMISSAO } from '@/lib/funnel-phases'
import { CheckoutModal } from '@/components/central-agentes/CheckoutModal'
import { CockpitResumo } from '@/components/home/CockpitResumo'

const ICONES_AGENTE: Record<string, LucideIcon> = {
  assessor: ClipboardList,
  copiloto: Mic,
  base_ativa: Target,
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

interface AgentConfig {
  ativo: boolean | null
  nome_agente: string | null
}

export default function Index() {
  const { user, papelAtivo } = useAuth()
  const { tenantId, usuarioId } = useActiveContext()
  const [hiredAgentIds, setHiredAgentIds] = useState<string[]>([])
  const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig>>({})
  const [userName, setUserName] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Record<string, number | null>>({
    assessor: null,
    copiloto: null,
    base_ativa: null,
  })
  const [loading, setLoading] = useState(true)
  const [checkoutAgent, setCheckoutAgent] = useState<string | null>(null)

  const isAdmin = papelAtivo === 'admin'

  useEffect(() => {
    async function loadData() {
      if (!user || !tenantId) {
        setLoading(false)
        return
      }

      const promises: Promise<void>[] = []

      promises.push(
        supabase
          .from('acesso_agentes')
          .select('agente_id')
          .eq('tenant_id', tenantId)
          .eq('ativo', true)
          .then(({ data, error }) => {
            if (!error && data) {
              setHiredAgentIds(data.map((d: any) => d.agente_id))
            }
          }),
      )

      promises.push(
        supabase
          .from('configuracoes_agente')
          .select('*')
          .eq('tenant_id', tenantId)
          .then(({ data }) => {
            const configMap: Record<string, AgentConfig> = {}
            for (const c of (data as any[]) ?? []) {
              if (c.agent_type) {
                configMap[c.agent_type] = {
                  ativo: c.ativo,
                  nome_agente: c.nome_agente ?? null,
                }
              }
            }
            setAgentConfigs(configMap)
          }),
      )

      if (usuarioId) {
        promises.push(
          supabase
            .from('usuarios')
            .select('nome')
            .eq('id', usuarioId)
            .maybeSingle()
            .then(({ data }) => {
              setUserName(data?.nome ?? null)
            }),
        )
      }

      promises.push(
        supabase
          .from('candidatos')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['novo', 'shortlist', 'agendado', 'entrevistado'])
          .then(({ count }) => {
            setMetrics((prev) => ({ ...prev, assessor: count ?? 0 }))
          }),
      )

      const now = new Date()
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      promises.push(
        supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'agendada')
          .gte('agendada_para', now.toISOString())
          .lte('agendada_para', sevenDaysLater.toISOString())
          .then(({ count }) => {
            setMetrics((prev) => ({ ...prev, copiloto: count ?? 0 }))
          }),
      )

      promises.push(
        supabase
          .from('base_ativa')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('opt_out', false)
          .then(({ count }) => {
            setMetrics((prev) => ({ ...prev, base_ativa: count ?? 0 }))
          }),
      )

      await Promise.all(promises)
      setLoading(false)
    }
    loadData()
  }, [user, tenantId, usuarioId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const greeting = getGreeting()
  const firstName = userName ? userName.split(' ')[0] : null
  const activeCount = AGENTES.filter((a) => agenteContratado(hiredAgentIds, a.agentType)).length

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Meus agentes</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {activeCount} de {AGENTES.length} ativos
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {AGENTES.map((agent) => {
          const Icon = ICONES_AGENTE[agent.agentType]
          const isHired = agenteContratado(hiredAgentIds, agent.agentType)
          const config = agentConfigs[agent.agentType]
          const isPaused = config?.ativo === false
          const customName = config?.nome_agente ?? null
          const displayName = customName ?? agent.nome
          const valorMetrica = isHired ? metrics[agent.agentType] : null

          return (
            <Card
              key={agent.id}
              className={cn(
                'relative overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md border-slate-200',
                !isHired && 'opacity-90',
              )}
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: agent.cor + '1a', color: agent.cor }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1">
                    {isHired && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <Link to={`/agentes/configuracoes?aba=${agent.agentType}`}>
                          <Settings2 className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                    {isHired ? (
                      isPaused ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 font-medium"
                        >
                          Pausado
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                        >
                          Ativo
                        </Badge>
                      )
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-slate-500 border-slate-200 font-medium"
                      >
                        Inativo
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-xl">{displayName}</CardTitle>
                {customName && <p className="text-xs text-slate-400">{agent.nome}</p>}
                {isHired ? (
                  <div className="pt-2 min-h-[80px]">
                    <p className="text-3xl font-bold text-slate-900">
                      {valorMetrica !== null && valorMetrica !== undefined ? valorMetrica : '—'}
                    </p>
                    <p className="text-sm text-slate-500">{agent.rotuloMetrica}</p>
                  </div>
                ) : (
                  <CardDescription className="pt-2 text-slate-600 min-h-[80px]">
                    {agent.descricao}
                  </CardDescription>
                )}
              </CardHeader>
              <CardFooter className="mt-auto pt-4 border-t border-slate-100 bg-slate-50/50">
                {isHired ? (
                  <Link to={agent.rota} className="w-full">
                    <Button
                      className="w-full gap-2 text-white hover:opacity-90"
                      style={{ backgroundColor: agent.cor }}
                    >
                      Acessar <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : isAdmin ? (
                  <Button
                    className="w-full gap-2 text-white hover:opacity-90"
                    style={{ backgroundColor: agent.cor }}
                    onClick={() => setCheckoutAgent(agent.agentType)}
                  >
                    Contratar
                  </Button>
                ) : (
                  <p className="w-full text-center text-sm text-slate-500">
                    {CTA_CONTRATAR_SEM_PERMISSAO}
                  </p>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <CockpitResumo />

      {checkoutAgent && (
        <CheckoutModal
          open={!!checkoutAgent}
          onOpenChange={(open) => !open && setCheckoutAgent(null)}
          agentId={checkoutAgent}
          onSuccess={() => {
            setCheckoutAgent(null)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
