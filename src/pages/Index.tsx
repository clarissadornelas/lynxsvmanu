import { useState, useEffect } from 'react'
import { ClipboardList, Mic, Target, ArrowRight, Loader2, Settings2 } from 'lucide-react'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { AGENT_BY_KEY, formatBRL } from '@/lib/constants'
import { CheckoutModal } from '@/components/central-agentes/CheckoutModal'
import { CockpitResumo } from '@/components/home/CockpitResumo'

interface AgentConfig {
  ativo: boolean | null
  nome_agente: string | null
}

export default function Index() {
  const { user } = useAuth()
  const { tenantId } = useActiveContext()
  const [hiredAgentIds, setHiredAgentIds] = useState<string[]>([])
  const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig>>({})
  const [loading, setLoading] = useState(true)
  const [checkoutAgent, setCheckoutAgent] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!user || !tenantId) {
        setLoading(false)
        return
      }

      const { data: acesso, error } = await supabase
        .from('acesso_agentes')
        .select('agente_id')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)

      if (!error && acesso) {
        setHiredAgentIds(acesso.map((d: any) => d.agente_id))
      }

      const { data: configs } = await supabase
        .from('configuracoes_agente')
        .select('*')
        .eq('tenant_id', tenantId)

      const configMap: Record<string, AgentConfig> = {}
      for (const c of (configs as any[]) ?? []) {
        if (c.agent_type) {
          configMap[c.agent_type] = {
            ativo: c.ativo,
            nome_agente: c.nome_agente ?? null,
          }
        }
      }
      setAgentConfigs(configMap)

      setLoading(false)
    }
    loadData()
  }, [user, tenantId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const agents = [
    {
      id: '01',
      agentType: 'assessor',
      name: 'Meu Assessor',
      icon: ClipboardList,
      colorStyles: {
        text: 'text-[#457B9D]',
        bg: 'bg-[#457B9D]/10',
        button: 'bg-[#457B9D] hover:bg-[#3d6e8c]',
      },
      description:
        'Mande os currículos pelo WhatsApp. O assessor entra em contato com cada candidato e faz os agendamentos.',
      link: '/agente-01',
    },
    {
      id: '02',
      agentType: 'copiloto',
      name: 'Copiloto',
      icon: Mic,
      colorStyles: {
        text: 'text-[#06A77D]',
        bg: 'bg-[#06A77D]/10',
        button: 'bg-[#06A77D] hover:bg-[#059670]',
      },
      description: 'Transcrição de entrevistas com parecer comportamental DISC',
      link: '/agente-02',
    },
    {
      id: '03',
      agentType: 'base_ativa',
      name: 'Base Ativa',
      icon: Target,
      colorStyles: {
        text: 'text-[#F77F00]',
        bg: 'bg-[#F77F00]/10',
        button: 'bg-[#F77F00] hover:bg-[#e67500]',
      },
      description:
        'O candidato que não deu match hoje vale ouro amanhã. Mantenha a sua base ativa com notificações periódicas e banco de talentos',
      link: '/agente-03',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <CockpitResumo />
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Meus agentes</h2>
        <p className="text-sm text-slate-500 mt-0.5">Escolha qual agente você deseja usar</p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const Icon = agent.icon
          const isHired = hiredAgentIds.includes(agent.id)
          const config = agentConfigs[agent.agentType]
          const isPaused = config?.ativo === false
          const customName = config?.nome_agente ?? null
          const price = AGENT_BY_KEY[agent.agentType]?.price ?? 0

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
                    className={cn('p-3 rounded-xl', agent.colorStyles.bg, agent.colorStyles.text)}
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
                          Contratado
                        </Badge>
                      )
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-slate-500 border-slate-200 font-medium"
                      >
                        Indisponível
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-xl">{customName ? customName : agent.name}</CardTitle>
                {customName && <p className="text-xs text-slate-400">{agent.name}</p>}
                <CardDescription className="pt-2 text-slate-600 min-h-[80px]">
                  {agent.description}
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto pt-4 border-t border-slate-100 bg-slate-50/50">
                {isHired ? (
                  <Link to={agent.link} className="w-full">
                    <Button className={cn('w-full gap-2 text-white', agent.colorStyles.button)}>
                      Acessar <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-xl font-bold text-slate-900">
                        R$ {formatBRL(price)}
                      </span>
                      <span className="text-sm font-medium text-slate-500">/mês</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full bg-white hover:bg-slate-50 border-slate-200"
                      onClick={() => setCheckoutAgent(agent.agentType)}
                    >
                      Contratar
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

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
