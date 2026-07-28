import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  RefreshCw,
  CheckCircle2,
  FlaskConical,
  AlertTriangle,
  Repeat,
  Clock,
  Loader2,
  Info,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { AgentControlCard } from '@/components/central-agentes/AgentControlCard'
import { ActionQueueItem } from '@/components/central-agentes/ActionQueueItem'
import { HistoryItem } from '@/components/central-agentes/HistoryItem'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useActiveContext } from '@/stores/useActiveContext'
import { supabase } from '@/lib/supabase/client'
import { getTodayRange } from '@/lib/agent-utils'
import { useAuth } from '@/hooks/use-auth'
import { CheckoutModal } from '@/components/central-agentes/CheckoutModal'

const AGENT_TYPES = ['assessor', 'base_ativa'] as const

const ACESSO_TYPE_MAP: Record<string, string> = {
  '01': 'assessor',
  '02': 'copiloto',
  '03': 'base_ativa',
}

interface AgentConfig {
  agent_type: string
  ativo: boolean
  modo: string
  dias_sem_resposta: number | null
  cadencia_follow_up_dias: number | null
  tom: string | null
  criterios_cv: string | null
  criterios_entrevista: string | null
}

interface RepetitionInfo {
  ordem: number
  total: number
  horas: number
}

interface AgentAction {
  id: string
  agent_type: string
  tipo_acao: string
  candidato_id: string | null
  agendada_para: string
  criado_em: string
  executada_em: string | null
  status: string
  texto_composto: string | null
  motivo_escalacao: string | null
  motivo: string | null
  resultado: string | null
  candidatos: { nome: string | null } | null
}

function contarRepeticoes(actions: AgentAction[]): Map<string, RepetitionInfo> {
  const groups: Record<string, AgentAction[]> = {}

  for (const action of actions) {
    if (!action.candidato_id) continue
    const key = `${action.candidato_id}_${action.tipo_acao}`
    if (!groups[key]) groups[key] = []
    groups[key].push(action)
  }

  const result = new Map<string, RepetitionInfo>()

  for (const groupActions of Object.values(groups)) {
    groupActions.sort((a, b) => {
      const ta = new Date(a.executada_em || a.criado_em).getTime()
      const tb = new Date(b.executada_em || b.criado_em).getTime()
      return ta - tb
    })

    const total = groupActions.length
    if (total < 3) continue

    const firstTime = new Date(groupActions[0].executada_em || groupActions[0].criado_em).getTime()
    const lastTime = new Date(
      groupActions[total - 1].executada_em || groupActions[total - 1].criado_em,
    ).getTime()
    const horas = Math.max(1, Math.round((lastTime - firstTime) / (1000 * 60 * 60)))

    groupActions.forEach((action, index) => {
      result.set(action.id, { ordem: index + 1, total, horas })
    })
  }

  return result
}

export default function CentralAgentes() {
  const { tenantId } = useActiveContext()
  const { papelAtivo } = useAuth()
  const { toast } = useToast()
  const [acessoData, setAcessoData] = useState<Record<string, boolean>>({})
  const [checkoutAgent, setCheckoutAgent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [configs, setConfigs] = useState<Record<string, AgentConfig>>({})
  const [escalation, setEscalation] = useState<AgentAction[]>([])
  const [upcoming, setUpcoming] = useState<AgentAction[]>([])
  const [historico, setHistorico] = useState<AgentAction[]>([])
  const [stats, setStats] = useState({ concluida: 0, simulada: 0, falhou: 0 })
  const [tenantJanela, setTenantJanela] = useState({ inicio: 8, fim: 20 })
  const [toggling, setToggling] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!tenantId) return
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const { start, end } = getTodayRange()

      const [configsRes, escRes, upRes, concRes, simRes, falRes, tenantRes, acessoRes, histRes] =
        await Promise.all([
          supabase.from('configuracoes_agente').select('*').eq('tenant_id', tenantId),
          supabase
            .from('acoes_agente')
            .select('*, candidatos(nome)')
            .eq('tenant_id', tenantId)
            .eq('status', 'aguardando_humano')
            .order('criado_em', { ascending: true }),
          supabase
            .from('acoes_agente')
            .select('*, candidatos(nome)')
            .eq('tenant_id', tenantId)
            .eq('status', 'pendente')
            .order('agendada_para', { ascending: true })
            .limit(20),
          supabase
            .from('acoes_agente')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .eq('status', 'concluida')
            .gte('executada_em', start)
            .lt('executada_em', end),
          supabase
            .from('acoes_agente')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .eq('status', 'simulada')
            .gte('executada_em', start)
            .lt('executada_em', end),
          supabase
            .from('acoes_agente')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .eq('status', 'falhou')
            .gte('executada_em', start)
            .lt('executada_em', end),
          supabase.from('tenants').select('janela_inicio, janela_fim').eq('id', tenantId).single(),
          supabase
            .from('acesso_agentes')
            .select('agente_id, ativo')
            .eq('tenant_id', tenantId)
            .eq('ativo', true),
          supabase
            .from('acoes_agente')
            .select('*, candidatos(nome)')
            .eq('tenant_id', tenantId)
            .in('status', ['concluida', 'simulada', 'falhou', 'cancelada'])
            .not('executada_em', 'is', null)
            .order('executada_em', { ascending: false })
            .limit(40),
        ])

      const errors = [
        configsRes,
        escRes,
        upRes,
        concRes,
        simRes,
        falRes,
        tenantRes,
        acessoRes,
        histRes,
      ].filter((r) => r.error)
      if (errors.length > 0) {
        toast({
          title: 'Erro ao carregar dados',
          description: (errors[0].error as any)?.message,
          variant: 'destructive',
        })
      }

      const configMap: Record<string, AgentConfig> = {}
      for (const c of (configsRes.data as any[] | null) ?? []) {
        const at = c.agent_type ?? c.tipo_agente
        if (at) {
          configMap[at] = {
            agent_type: at,
            ativo: c.ativo ?? true,
            modo: c.modo ?? 'real',
            dias_sem_resposta: c.dias_sem_resposta ?? null,
            cadencia_follow_up_dias: c.cadencia_follow_up_dias ?? null,
            tom: c.tom ?? null,
            criterios_cv: c.criterios_cv ?? null,
            criterios_entrevista: c.criterios_entrevista ?? null,
          }
        }
      }
      setConfigs(configMap)
      const acessoMap: Record<string, boolean> = {}
      for (const a of (acessoRes.data as any[] | null) ?? []) {
        const type = ACESSO_TYPE_MAP[a.agente_id]
        if (type) acessoMap[type] = true
      }
      setAcessoData(acessoMap)
      if (tenantRes.data) {
        setTenantJanela({
          inicio: tenantRes.data.janela_inicio ?? 8,
          fim: tenantRes.data.janela_fim ?? 20,
        })
      }
      setEscalation((escRes.data as AgentAction[]) ?? [])
      setUpcoming((upRes.data as AgentAction[]) ?? [])
      setHistorico((histRes.data as AgentAction[]) ?? [])
      setStats({
        concluida: concRes.count ?? 0,
        simulada: simRes.count ?? 0,
        falhou: falRes.count ?? 0,
      })
      setLoading(false)
      setRefreshing(false)
    },
    [tenantId],
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggle = async (agentType: string, value: boolean) => {
    if (!tenantId) return
    setToggling(agentType)
    try {
      const existing = configs[agentType]
      const { error } = await supabase.from('configuracoes_agente').upsert(
        {
          tenant_id: tenantId,
          agent_type: agentType,
          ativo: value,
          modo: existing?.modo ?? 'real',
        } as any,
        { onConflict: 'tenant_id,agent_type' },
      )
      if (error) throw error
      setConfigs((prev) => ({
        ...prev,
        [agentType]: {
          agent_type: agentType,
          ativo: value,
          modo: existing?.modo ?? 'real',
          dias_sem_resposta: null,
          cadencia_follow_up_dias: null,
          tom: null,
          criterios_cv: null,
          criterios_entrevista: null,
        },
      }))
      toast({ title: value ? 'Agente ativado' : 'Agente desativado' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  const handleResolve = async (id: string) => {
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('acoes_agente')
        .update({ status: 'concluida', executada_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setEscalation((prev) => prev.filter((a) => a.id !== id))
      toast({ title: 'Ação resolvida' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (id: string, from: 'escalation' | 'upcoming') => {
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('acoes_agente')
        .update({ status: 'cancelada' })
        .eq('id', id)
      if (error) throw error
      if (from === 'escalation') setEscalation((prev) => prev.filter((a) => a.id !== id))
      else setUpcoming((prev) => prev.filter((a) => a.id !== id))
      toast({ title: 'Ação cancelada' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const allActions = useMemo(
    () => [...escalation, ...upcoming, ...historico],
    [escalation, upcoming, historico],
  )
  const repetitionMap = useMemo(() => contarRepeticoes(allActions), [allActions])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const assessorDias = configs['assessor']?.dias_sem_resposta
  const assessorSummary = `janela ${tenantJanela.inicio}h–${tenantJanela.fim}h · desiste após ${assessorDias ?? 5}${assessorDias == null ? ' (padrão)' : ''} dias`
  const baseAtivaCadencia = configs['base_ativa']?.cadencia_follow_up_dias
  const baseAtivaSummary = `follow-up a cada ${baseAtivaCadencia ?? 7}${baseAtivaCadencia == null ? ' (padrão)' : ''} dias · tom ${configs['base_ativa']?.tom ?? 'profissional'}`
  const copilotoConfig = configs['copiloto']
  const copilotoSummary = `critérios de avaliação ${copilotoConfig?.criterios_cv || copilotoConfig?.criterios_entrevista ? 'definidos' : 'não definidos'}`

  const renderAgentLane = (agentType: string) => {
    const fEsc = escalation.filter((a) => a.agent_type === agentType)
    const fUp = upcoming.filter((a) => a.agent_type === agentType)
    const fHist = historico.filter((a) => a.agent_type === agentType)
    const { start, end } = getTodayRange()
    const todayCount = fHist.filter(
      (a) =>
        a.executada_em &&
        new Date(a.executada_em) >= new Date(start) &&
        new Date(a.executada_em) < new Date(end),
    ).length
    const repCount = fHist.filter((a) => {
      const r = repetitionMap.get(a.id)
      return r && r.total >= 3
    }).length
    const isEmpty = fEsc.length === 0 && fUp.length === 0 && fHist.length === 0

    return (
      <div className="space-y-6">
        <AgentControlCard
          agentType={agentType}
          ativo={configs[agentType]?.ativo ?? true}
          modo={configs[agentType]?.modo ?? 'real'}
          onToggle={(v) => handleToggle(agentType, v)}
          loading={toggling === agentType}
          hasSwitch
          isHired={acessoData[agentType] ?? false}
          papelAtivo={papelAtivo}
          onHire={() => setCheckoutAgent(agentType)}
          summary={agentType === 'assessor' ? assessorSummary : baseAtivaSummary}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={AlertTriangle}
            label="Aguardando você"
            value={fEsc.length}
            color="text-amber-600"
          />
          <StatCard icon={Clock} label="A caminho" value={fUp.length} color="text-blue-600" />
          <StatCard
            icon={CheckCircle2}
            label="Feito hoje"
            value={todayCount}
            color="text-green-600"
          />
          <StatCard icon={Repeat} label="Repetidas" value={repCount} color="text-amber-600" />
        </div>
        {isEmpty ? (
          <p className="text-sm text-slate-400 py-8 text-center">Nada para mostrar aqui ainda.</p>
        ) : (
          <div className="space-y-6">
            {fEsc.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">Aguardando você</h2>
                <div className="space-y-2">
                  {fEsc.map((a) => (
                    <ActionQueueItem
                      key={a.id}
                      action={a}
                      variant="escalation"
                      onResolve={handleResolve}
                      onCancel={(id) => handleCancel(id, 'escalation')}
                      loading={actionLoading === a.id}
                      repetition={repetitionMap.get(a.id) ?? null}
                    />
                  ))}
                </div>
              </div>
            )}
            {fUp.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">A caminho</h2>
                <div className="space-y-2">
                  {fUp.map((a) => (
                    <ActionQueueItem
                      key={a.id}
                      action={a}
                      variant="upcoming"
                      onCancel={(id) => handleCancel(id, 'upcoming')}
                      loading={actionLoading === a.id}
                      repetition={repetitionMap.get(a.id) ?? null}
                    />
                  ))}
                </div>
              </div>
            )}
            {fHist.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">Feito recentemente</h2>
                <div className="space-y-2">
                  {fHist.slice(0, 20).map((a) => (
                    <HistoryItem
                      key={a.id}
                      action={a}
                      repetition={repetitionMap.get(a.id) ?? null}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader title="Central de Agentes" subtitle="Acompanhe e controle o trabalho dos agentes">
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Atualizar
        </Button>
      </PageHeader>

      <Tabs defaultValue="todos">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="assessor">Meu Assessor</TabsTrigger>
          <TabsTrigger value="base_ativa">Base Ativa</TabsTrigger>
          <TabsTrigger value="copiloto">Copiloto</TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-6 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={CheckCircle2}
              label="Executadas hoje"
              value={stats.concluida}
              color="text-green-600"
            />
            <StatCard
              icon={FlaskConical}
              label="Simuladas hoje"
              value={stats.simulada}
              color="text-blue-600"
            />
            <StatCard
              icon={AlertTriangle}
              label="Falhas hoje"
              value={stats.falhou}
              color="text-red-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {AGENT_TYPES.map((at) => (
              <AgentControlCard
                key={at}
                agentType={at}
                ativo={configs[at]?.ativo ?? true}
                modo={configs[at]?.modo ?? 'real'}
                onToggle={(v) => handleToggle(at, v)}
                loading={toggling === at}
                hasSwitch
                isHired={acessoData[at] ?? false}
                papelAtivo={papelAtivo}
                onHire={() => setCheckoutAgent(at)}
                summary={
                  at === 'assessor'
                    ? assessorSummary
                    : at === 'base_ativa'
                      ? baseAtivaSummary
                      : undefined
                }
              />
            ))}
            <AgentControlCard
              agentType="copiloto"
              ativo={false}
              modo=""
              onToggle={() => {}}
              loading={false}
              hasSwitch={false}
              isHired={acessoData['copiloto'] ?? false}
              papelAtivo={papelAtivo}
              description="sob demanda, não opera sozinho"
              summary={copilotoSummary}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Aguardando você</h2>
              {escalation.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center rounded-lg border border-dashed border-slate-200">
                  Nada esperando por você
                </p>
              ) : (
                <div className="space-y-2">
                  {escalation.map((a) => (
                    <ActionQueueItem
                      key={a.id}
                      action={a}
                      variant="escalation"
                      onResolve={handleResolve}
                      onCancel={(id) => handleCancel(id, 'escalation')}
                      loading={actionLoading === a.id}
                      repetition={repetitionMap.get(a.id) ?? null}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Próximas ações</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center rounded-lg border border-dashed border-slate-200">
                  Nenhuma ação agendada
                </p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((a) => (
                    <ActionQueueItem
                      key={a.id}
                      action={a}
                      variant="upcoming"
                      onCancel={(id) => handleCancel(id, 'upcoming')}
                      loading={actionLoading === a.id}
                      repetition={repetitionMap.get(a.id) ?? null}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {historico.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Feito recentemente</h2>
              <div className="space-y-2">
                {historico.slice(0, 10).map((a) => (
                  <HistoryItem key={a.id} action={a} repetition={repetitionMap.get(a.id) ?? null} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assessor" className="mt-4">
          {renderAgentLane('assessor')}
        </TabsContent>

        <TabsContent value="base_ativa" className="mt-4">
          {renderAgentLane('base_ativa')}
        </TabsContent>

        <TabsContent value="copiloto" className="mt-4">
          <div className="space-y-6">
            <AgentControlCard
              agentType="copiloto"
              ativo={false}
              modo=""
              onToggle={() => {}}
              loading={false}
              hasSwitch={false}
              isHired={acessoData['copiloto'] ?? false}
              papelAtivo={papelAtivo}
              description="sob demanda, não opera sozinho"
              summary={copilotoSummary}
            />
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                O Copiloto trabalha dentro da entrevista: prepara o roteiro antes e escreve o
                parecer depois. Ele não conversa com candidato, então não tem fila de ações.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {checkoutAgent && (
        <CheckoutModal
          open={!!checkoutAgent}
          onOpenChange={(open) => !open && setCheckoutAgent(null)}
          agentId={checkoutAgent}
          onSuccess={() => loadData(true)}
        />
      )}
    </div>
  )
}
