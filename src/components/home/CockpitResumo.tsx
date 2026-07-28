import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, Mic, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { formatRelativeTimestamp } from '@/lib/agent-utils'

interface MetricData {
  emProcesso: number | null
  entrevistas7d: number | null
  baseAtiva: number | null
}

interface ActivityItem {
  id: string
  agent_type: string
  texto_composto: string | null
  executada_em: string | null
}

interface PendenciaItem {
  id: string
  texto: string
  meta: string
  acao: string
  agente: string | null
}

interface EsfriandoItem {
  id: string
  texto: string
  meta: string
}

const AGENT_LABELS: Record<string, string> = {
  assessor: 'Meu Assessor',
  copiloto: 'Copiloto',
  base_ativa: 'Base Ativa',
}

const AGENT_DOT_COLORS: Record<string, string> = {
  assessor: 'bg-agente-assessor',
  copiloto: 'bg-agente-copiloto',
  base_ativa: 'bg-agente-base-ativa',
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getRelativeDeadline(deadlineStr: string): string {
  const now = new Date()
  const deadline = new Date(deadlineStr)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const deadlineStart = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())
  const diffDays = Math.round(
    (deadlineStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'em 1 dia'
  return `em ${diffDays} dias`
}

export function CockpitResumo() {
  const { tenantId, usuarioId } = useActiveContext()
  const [userName, setUserName] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<MetricData>({
    emProcesso: null,
    entrevistas7d: null,
    baseAtiva: null,
  })
  const [activities, setActivities] = useState<ActivityItem[] | null>(null)
  const [precisaDeVoce, setPrecisaDeVoce] = useState<PendenciaItem[] | null>(null)
  const [esfriando, setEsfriando] = useState<EsfriandoItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  const [aberto, setAberto] = useState<Record<string, boolean>>({
    precisa: true,
    esfriando: true,
    atividade: false,
  })

  const toggle = (key: string) => {
    setAberto((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    async function loadData() {
      if (!tenantId) {
        setLoading(false)
        return
      }

      const promises: Promise<void>[] = []

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
            setMetrics((prev) => ({ ...prev, emProcesso: count ?? 0 }))
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
            setMetrics((prev) => ({ ...prev, entrevistas7d: count ?? 0 }))
          }),
      )

      promises.push(
        supabase
          .from('base_ativa')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('opt_out', false)
          .then(({ count }) => {
            setMetrics((prev) => ({ ...prev, baseAtiva: count ?? 0 }))
          }),
      )

      promises.push(
        supabase
          .from('acoes_agente')
          .select('id, agent_type, texto_composto, executada_em')
          .eq('tenant_id', tenantId)
          .eq('status', 'concluida')
          .order('executada_em', { ascending: false })
          .limit(5)
          .then(({ data }) => {
            setActivities((data as ActivityItem[]) ?? [])
          }),
      )

      promises.push(
        (async () => {
          const { data: entrevistasData } = await supabase
            .from('entrevistas')
            .select('id, candidato_id, vaga_id')
            .eq('tenant_id', tenantId)
            .eq('status', 'realizada')
            .is('parecer', null)
            .limit(4)

          const items: PendenciaItem[] = []
          for (const ent of (entrevistasData as any[]) ?? []) {
            let texto = 'Entrevista realizada'
            if (ent.candidato_id) {
              const { data: cand } = await supabase
                .from('candidatos')
                .select('nome')
                .eq('id', ent.candidato_id)
                .maybeSingle()
              if (cand?.nome) texto = cand.nome
            }
            items.push({
              id: ent.id,
              texto,
              meta: 'Copiloto',
              acao: 'Revisar',
              agente: 'copiloto',
            })
          }

          const { count: novoCount } = await supabase
            .from('candidatos')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'novo')

          if (novoCount && novoCount > 0 && items.length < 4) {
            items.push({
              id: 'candidatos-novos',
              texto: `${novoCount} candidato${novoCount > 1 ? 's' : ''} aguardando triagem`,
              meta: 'A Triar',
              acao: 'Triar',
              agente: null,
            })
          }

          setPrecisaDeVoce(items)
        })(),
      )

      promises.push(
        (async () => {
          const { data: vagasData } = await supabase
            .from('vagas')
            .select('id, titulo, data_limite')
            .eq('tenant_id', tenantId)
            .eq('status', 'aberta')
            .not('data_limite', 'is', null)
            .order('data_limite', { ascending: true })
            .limit(20)

          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const sevenDaysEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)

          const items: EsfriandoItem[] = []
          for (const vaga of (vagasData as any[]) ?? []) {
            const deadline = new Date(vaga.data_limite)
            if (deadline >= todayStart && deadline <= sevenDaysEnd) {
              items.push({
                id: vaga.id,
                texto: vaga.titulo ?? 'Vaga sem título',
                meta: getRelativeDeadline(vaga.data_limite),
              })
            }
            if (items.length >= 4) break
          }

          setEsfriando(items)
        })(),
      )

      await Promise.all(promises)
      setLoading(false)
    }

    loadData()
  }, [tenantId, usuarioId])

  const firstName = userName ? userName.split(' ')[0] : null
  const greeting = firstName ? `${getGreeting()}, ${firstName}` : getGreeting()

  const tiles = [
    {
      label: 'Em processo',
      icon: ClipboardList,
      value: metrics.emProcesso,
      barColor: 'bg-agente-assessor',
      iconColor: 'text-agente-assessor-forte',
      iconBg: 'bg-agente-assessor/10',
    },
    {
      label: 'Entrevistas',
      icon: Mic,
      value: metrics.entrevistas7d,
      barColor: 'bg-agente-copiloto',
      iconColor: 'text-agente-copiloto-forte',
      iconBg: 'bg-agente-copiloto/10',
    },
    {
      label: 'Base de talentos',
      icon: Target,
      value: metrics.baseAtiva,
      barColor: 'bg-agente-base-ativa',
      iconColor: 'text-agente-base-ativa-forte',
      iconBg: 'bg-agente-base-ativa/10',
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">{greeting}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <div
              key={tile.label}
              className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className={`absolute top-0 left-0 h-1 w-full ${tile.barColor}`} />
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${tile.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${tile.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{tile.label}</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {tile.value === null ? '—' : tile.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('precisa')}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          {aberto.precisa ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-700">Precisa de você</span>
          {precisaDeVoce && precisaDeVoce.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {precisaDeVoce.length}
            </span>
          )}
        </button>
        {aberto.precisa && (
          <div className="px-4 pb-3">
            {precisaDeVoce === null ? (
              <p className="text-sm text-slate-400 py-2">Carregando…</p>
            ) : precisaDeVoce.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Nada esperando por você agora.</p>
            ) : (
              <div className="space-y-1">
                {precisaDeVoce.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        item.agente
                          ? (AGENT_DOT_COLORS[item.agente] ?? 'bg-slate-400')
                          : 'bg-slate-400'
                      }`}
                    />
                    <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                      {item.texto}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{item.meta}</span>
                    <span className="text-xs font-medium text-slate-600 shrink-0">{item.acao}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('esfriando')}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          {aberto.esfriando ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-700">Esfriando</span>
          {esfriando && esfriando.length > 0 && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
              {esfriando.length}
            </span>
          )}
        </button>
        {aberto.esfriando && (
          <div className="px-4 pb-3">
            {esfriando === null ? (
              <p className="text-sm text-slate-400 py-2">Carregando…</p>
            ) : esfriando.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Nada esfriando no momento.</p>
            ) : (
              <div className="space-y-1">
                {esfriando.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2"
                  >
                    <span className="h-5 w-0.5 shrink-0 bg-warning" />
                    <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                      {item.texto}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{item.meta}</span>
                    <span className="text-xs font-medium text-slate-600 shrink-0">Ver vaga</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('atividade')}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          {aberto.atividade ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-700">Atividade recente</span>
          {activities && activities.length > 0 && (
            <span className="text-xs text-slate-400">
              {activities.length} {activities.length === 1 ? 'ação' : 'ações'} dos agentes
            </span>
          )}
        </button>
        {aberto.atividade && (
          <div className="px-4 pb-3">
            {loading ? (
              <p className="text-sm text-slate-400 py-2">Carregando…</p>
            ) : activities && activities.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Nenhuma ação executada ainda.</p>
            ) : (
              <div className="space-y-2">
                {activities?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        AGENT_DOT_COLORS[item.agent_type] ?? 'bg-slate-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {AGENT_LABELS[item.agent_type] ?? item.agent_type}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {item.texto_composto ?? '—'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {item.executada_em ? formatRelativeTimestamp(item.executada_em) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
