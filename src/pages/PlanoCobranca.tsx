import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Loader2, Plus } from 'lucide-react'
import {
  AGENTS,
  AGENT_BY_KEY,
  AGENT_BY_NUMERIC_ID,
  PLAN_NAME,
  PEDIDO_STATUS_STYLES,
  PEDIDO_STATUS_LABELS,
  formatBRL,
} from '@/lib/constants'
import { CheckoutModal } from '@/components/central-agentes/CheckoutModal'
import { buscarUsoEmpresa, LIMITES_POR_PLANO, DimensaoLimite, UsoEmpresa } from '@/lib/limites'
import { cn } from '@/lib/utils'

interface Pedido {
  id: string
  criado_em: string
  agente_id: string
  plano: string
  cupom: string | null
  status: string
}

const USO_LABELS: Record<DimensaoLimite, string> = {
  membros: 'Membros',
  vagas_abertas: 'Vagas abertas',
  base_ativa: 'Talentos na base',
  entrevistas_mes: 'Entrevistas no mês',
}

const USO_DIMENSOES: DimensaoLimite[] = [
  'membros',
  'vagas_abertas',
  'base_ativa',
  'entrevistas_mes',
]

export default function PlanoCobranca() {
  const { papelAtivo } = useAuth()
  const { tenantId } = useActiveContext()
  const [loading, setLoading] = useState(true)
  const [tenantName, setTenantName] = useState('')
  const [activeAgents, setActiveAgents] = useState<Record<string, { plano_contratado: string }>>({})
  const [cortesiaAgents, setCortesiaAgents] = useState<Set<string>>(new Set())
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [checkoutAgent, setCheckoutAgent] = useState<string | null>(null)
  const [uso, setUso] = useState<UsoEmpresa | null>(null)

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const [agentsRes, pedidosRes, tenantRes, usoData] = await Promise.all([
      supabase
        .from('acesso_agentes')
        .select('agente_id, plano_contratado')
        .eq('tenant_id', tenantId)
        .eq('ativo', true),
      supabase
        .from('pedidos')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('criado_em', { ascending: false }),
      supabase.from('tenants').select('nome').eq('id', tenantId).single(),
      buscarUsoEmpresa(tenantId),
    ])

    if (agentsRes.error) {
      console.error('Erro ao buscar agentes:', agentsRes.error)
    } else if (agentsRes.data) {
      const map: Record<string, { plano_contratado: string }> = {}
      agentsRes.data.forEach((a) => {
        map[a.agente_id] = { plano_contratado: a.plano_contratado }
      })
      setActiveAgents(map)
    }

    if (pedidosRes.error) {
      console.error('Erro ao buscar pedidos:', pedidosRes.error)
    } else if (pedidosRes.data) {
      setPedidos(pedidosRes.data as Pedido[])
      const cortesia = new Set<string>()
      pedidosRes.data.forEach((p: Pedido) => {
        if (p.status === 'cortesia') cortesia.add(p.agente_id)
      })
      setCortesiaAgents(cortesia)
    }

    if (tenantRes.error) {
      console.error('Erro ao buscar tenant:', tenantRes.error)
    } else if (tenantRes.data) {
      setTenantName(tenantRes.data.nome)
    }

    setUso(usoData)
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalMensal = AGENTS.reduce((sum, agent) => {
    if (!activeAgents[agent.numericId] || cortesiaAgents.has(agent.numericId)) return sum
    return sum + agent.price
  }, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  const isAdmin = papelAtivo === 'admin'

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plano da empresa {tenantName}</h1>
        <p className="text-sm text-slate-500 mt-1">Cada empresa tem seu próprio plano.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agentes contratados</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {AGENTS.map((agent) => {
            const active = activeAgents[agent.numericId]
            const isCortesia = cortesiaAgents.has(agent.numericId)
            return (
              <div
                key={agent.key}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-slate-900">{agent.name}</p>
                  {active ? (
                    <p className="text-sm text-slate-500">
                      {active.plano_contratado} •{' '}
                      {isCortesia ? 'R$ 0,00 (cortesia)' : `R$ ${formatBRL(agent.price)}/mês`}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">Não contratado</p>
                  )}
                </div>
                {!active &&
                  (isAdmin ? (
                    <Button size="sm" onClick={() => setCheckoutAgent(agent.key)}>
                      <Plus className="w-4 h-4 mr-1" /> Contratar
                    </Button>
                  ) : (
                    <p className="text-xs text-slate-400">Disponível pelo administrador</p>
                  ))}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-base font-medium text-slate-900">Total mensal</span>
          <span className="text-xl font-bold text-indigo-600">R$ {formatBRL(totalMensal)}/mês</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uso da empresa</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {USO_DIMENSOES.map((dimensao) => {
            const limite = LIMITES_POR_PLANO[dimensao]
            const usoAtual = uso?.[dimensao] ?? 0
            const percent = limite !== null ? Math.min((usoAtual / limite) * 100, 100) : 0
            const warning = limite !== null && usoAtual >= limite * 0.8
            return (
              <div key={dimensao} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{USO_LABELS[dimensao]}</span>
                  <span className="text-sm text-slate-500">
                    {limite === null ? `${usoAtual}` : `${usoAtual} de ${limite}`}
                  </span>
                </div>
                {limite !== null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-full transition-all',
                        warning ? 'bg-amber-500' : 'bg-indigo-600',
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Nenhuma movimentação ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {AGENT_BY_NUMERIC_ID[p.agente_id]?.name ?? p.agente_id}
                    </TableCell>
                    <TableCell className="text-sm">{p.plano}</TableCell>
                    <TableCell className="text-sm">{p.cupom || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        className={PEDIDO_STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-600'}
                      >
                        {PEDIDO_STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 text-center">
        Pagamento online em breve. Pedidos aguardando pagamento serão cobrados quando o faturamento
        for ativado.
      </p>

      {checkoutAgent && (
        <CheckoutModal
          open={!!checkoutAgent}
          onOpenChange={(open) => !open && setCheckoutAgent(null)}
          agentId={checkoutAgent}
          onSuccess={() => {
            loadData()
          }}
        />
      )}
    </div>
  )
}
