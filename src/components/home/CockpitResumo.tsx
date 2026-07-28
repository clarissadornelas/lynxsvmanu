import { useEffect, useState } from 'react'
import { ClipboardList, Mic, Target } from 'lucide-react'
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

const AGENT_LABELS: Record<string, string> = {
  assessor: 'Meu Assessor',
  copiloto: 'Copiloto',
  base_ativa: 'Base Ativa',
}

const AGENT_DOT_COLORS: Record<string, string> = {
  assessor: 'bg-emerald-500',
  copiloto: 'bg-violet-500',
  base_ativa: 'bg-amber-500',
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
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
  const [loading, setLoading] = useState(true)

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
      barColor: 'bg-emerald-500',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      label: 'Entrevistas',
      icon: Mic,
      value: metrics.entrevistas7d,
      barColor: 'bg-violet-500',
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      label: 'Base de talentos',
      icon: Target,
      value: metrics.baseAtiva,
      barColor: 'bg-amber-500',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
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

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Atividade recente</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : activities && activities.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma ação executada ainda.</p>
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
                  <p className="text-xs text-slate-500 truncate">{item.texto_composto ?? '—'}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {item.executada_em ? formatRelativeTimestamp(item.executada_em) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
