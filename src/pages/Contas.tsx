import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Check, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AGENT_BY_NUMERIC_ID, formatBRL } from '@/lib/constants'

interface CompanyLink {
  id: string
  tenant_id: string
  papel: string
  tenant: { id: string; nome: string } | null
}

interface AgentSummary {
  count: number
  totalMensal: number
}

export default function Contas() {
  const { user } = useAuth()
  const { tenantId, setActive } = useActiveContext()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [links, setLinks] = useState<CompanyLink[]>([])
  const [agentSummaries, setAgentSummaries] = useState<Record<string, AgentSummary>>({})
  const [loading, setLoading] = useState(true)

  const loadLinks = useCallback(async () => {
    if (!user?.email) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, tenant_id, papel, tenants(id, nome)')
      .eq('email', user.email)
      .eq('ativo', true)
      .order('criado_em', { ascending: true })

    if (error) {
      console.error('Erro ao buscar empresas:', error)
      setLoading(false)
      return
    }

    const mapped: CompanyLink[] = (data || []).map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      papel: row.papel ?? 'usuario',
      tenant: row.tenants as CompanyLink['tenant'],
    }))

    const filtered = mapped.filter((l) => l.tenant)
    setLinks(filtered)

    const tenantIds = filtered.map((l) => l.tenant_id).filter(Boolean)
    if (tenantIds.length > 0) {
      const { data: agentesData, error: agentesError } = await supabase
        .from('acesso_agentes')
        .select('tenant_id, agente_id')
        .in('tenant_id', tenantIds)
        .eq('ativo', true)

      if (agentesError) {
        console.error('Erro ao buscar agentes:', agentesError)
      } else if (agentesData) {
        const summaries: Record<string, AgentSummary> = {}
        agentesData.forEach((a: any) => {
          if (!summaries[a.tenant_id]) {
            summaries[a.tenant_id] = { count: 0, totalMensal: 0 }
          }
          summaries[a.tenant_id].count += 1
          const agentInfo = AGENT_BY_NUMERIC_ID[a.agente_id]
          summaries[a.tenant_id].totalMensal += agentInfo?.price ?? 0
        })
        setAgentSummaries(summaries)
      }
    }

    setLoading(false)
  }, [user?.email])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  const handleSelectCompany = (link: CompanyLink) => {
    if (!link.tenant) return
    setActive(link.tenant.id, link.id)
    toast({ title: `Agora operando em ${link.tenant.nome}` })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Minhas empresas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Escolha em qual empresa você quer trabalhar agora
        </p>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma empresa associada ao seu email.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link) => {
            const isActive = link.tenant?.id === tenantId
            const summary = agentSummaries[link.tenant_id]
            return (
              <div
                key={link.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectCompany(link)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectCompany(link)
                  }
                }}
                className={cn(
                  'group relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-200',
                  isActive
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50',
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-lg flex items-center justify-center transition-colors',
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
                      )}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    {isActive && (
                      <div className="flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5">
                        <Check className="w-3 h-3 text-white" />
                        <span className="text-xs font-medium text-white">Ativa</span>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-slate-900 mb-1">{link.tenant?.nome}</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {summary?.count
                    ? `${summary.count} agentes ativos · R$ ${formatBRL(summary.totalMensal)}/mês`
                    : 'Sem agentes contratados'}
                </p>

                <Badge
                  variant={link.papel === 'admin' ? 'default' : 'secondary'}
                  className={cn(
                    'text-xs',
                    link.papel === 'admin'
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {link.papel === 'admin' ? 'Administrador' : 'Usuário'}
                </Badge>
              </div>
            )
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="py-5 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">Quer criar uma nova empresa?</p>
          <button
            onClick={() => navigate('/criar-empresa')}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            <Plus className="w-4 h-4" />
            Criar empresa
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
