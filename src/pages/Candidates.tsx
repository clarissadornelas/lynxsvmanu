import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FUNNEL_PHASES } from '@/lib/funnel-phases'
import { X, Users, Sparkles, Loader2, MessageSquare, Archive, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CandidateCard } from './candidatos/components/CandidateCard'
import { TalentCard } from './candidatos/components/TalentCard'
import { ImportModal } from './candidatos/components/ImportModal'
import { FilterSidebar } from './candidatos/components/FilterSidebar'
import { BaseAtivaSummary } from './candidatos/components/BaseAtivaSummary'
import { CandidateCardSkeleton } from '@/components/skeletons/CandidateCardSkeleton'
import { TalentCardSkeleton } from '@/components/skeletons/TalentCardSkeleton'
import { useCandidatesPagination } from '@/hooks/use-candidates-pagination'
import type { BaseAtivaWithRelations, CandidatoWithRelations } from '@/types/recruitment'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/avatar-utils'

export default function Candidates() {
  const { tenantId: activeTenantId } = useActiveContext()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [baseAtiva, setBaseAtiva] = useState<BaseAtivaWithRelations[]>([])
  const [loadingBase, setLoadingBase] = useState(true)
  const [nivelFiltro, setNivelFiltro] = useState('all')
  const [nichoFiltro, setNichoFiltro] = useState('')
  const [inactiveCandidates, setInactiveCandidates] = useState<CandidatoWithRelations[]>([])
  const [loadingInactive, setLoadingInactive] = useState(false)

  const {
    candidates,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    loadMore,
    search,
    setSearch,
    selectedPhases,
    selectedJobs,
    togglePhase,
    toggleJob,
    clearFilters,
    phaseCounts,
    jobOptions,
    updateLocalCandidate,
    refreshMetadata,
  } = useCandidatesPagination(activeTenantId)

  const loadBaseAtiva = async () => {
    if (!activeTenantId) return
    setTenantId(activeTenantId)
    setLoadingBase(true)
    try {
      const { data, error } = await supabase
        .from('base_ativa')
        .select('*, candidatos(foto_url)')
        .eq('tenant_id', activeTenantId)
        .order('criado_em', { ascending: false })
      if (error) throw error
      setBaseAtiva((data || []) as BaseAtivaWithRelations[])
    } catch {
      toast.error('Erro ao carregar Base de Talentos.')
      setBaseAtiva([])
    } finally {
      setLoadingBase(false)
    }
  }

  const loadInactiveCandidates = async () => {
    if (!activeTenantId) return
    setLoadingInactive(true)
    try {
      const { data, error } = await supabase
        .from('candidatos')
        .select('*, vagas(titulo), entrevistas(id, disc)')
        .eq('tenant_id', activeTenantId)
        .eq('status', 'inativo')
        .order('criado_em', { ascending: false })
      if (error) throw error
      setInactiveCandidates((data || []) as CandidatoWithRelations[])
    } catch {
      setInactiveCandidates([])
    } finally {
      setLoadingInactive(false)
    }
  }

  const reactivateCandidate = async (id: string) => {
    try {
      const { data: currentCand } = await supabase
        .from('candidatos')
        .select('status, tenant_id, vaga_id')
        .eq('id', id)
        .single()
      const prevStatus = currentCand?.status || 'inativo'

      const { error } = await supabase.from('candidatos').update({ status: 'novo' }).eq('id', id)
      if (error) throw error

      await supabase.from('candidato_eventos').insert({
        candidato_id: id,
        tipo: 'mudanca_fase',
        de: prevStatus,
        para: 'novo',
        agente: 'assessor',
        ator: 'operador',
        tenant_id: currentCand?.tenant_id || tenantId,
        vaga_id: currentCand?.vaga_id || null,
      })

      toast.success('Candidato reativado e movido para "A Triar".')
      setInactiveCandidates((prev) => prev.filter((c) => c.id !== id))
      refreshMetadata()
    } catch {
      toast.error('Erro ao reativar candidato.')
    }
  }

  useEffect(() => {
    loadBaseAtiva()
    loadInactiveCandidates()
  }, [activeTenantId])

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { data: currentCand } = await supabase
        .from('candidatos')
        .select('status, tenant_id, vaga_id')
        .eq('id', id)
        .single()
      const prevStatus = currentCand?.status || 'novo'

      const { error } = await supabase.from('candidatos').update({ status: newStatus }).eq('id', id)
      if (error) throw error

      await supabase.from('candidato_eventos').insert({
        candidato_id: id,
        tipo: 'mudanca_fase',
        de: prevStatus,
        para: newStatus,
        agente: 'assessor',
        ator: 'operador',
        tenant_id: currentCand?.tenant_id || tenantId,
        vaga_id: currentCand?.vaga_id || null,
      })

      if (newStatus === 'inativo') {
        toast.success('Candidato inativado e removido do funil ativo.')
        loadInactiveCandidates()
      } else if (newStatus === 'contratado') {
        toast.success('Status atualizado! Pipeline de onboarding (30/60/90 dias) ativado.')
      } else if (newStatus === 'reprovado' || newStatus === 'descartado') {
        await supabase.functions.invoke('crm-automation', {
          body: {
            task: 'status_changed',
            candidate_id: id,
            tenant_id: tenantId,
            new_status: newStatus,
          },
        })
        const { data: movedCand } = await supabase
          .from('candidatos')
          .select('nome, telefone, email, cargo, empresa')
          .eq('id', id)
          .single()
        if (movedCand?.telefone) {
          const { data: existingBase } = await supabase
            .from('base_ativa')
            .select('id')
            .eq('candidato_id', id)
            .maybeSingle()
          if (!existingBase) {
            const { error: baseError } = await supabase.from('base_ativa').insert({
              candidato_id: id,
              nome: movedCand.nome,
              telefone: movedCand.telefone,
              email: movedCand.email || null,
              ultimo_cargo: movedCand.cargo || null,
              empresa_atual: movedCand.empresa || null,
              origem: 'funil',
              tenant_id: tenantId,
              status_profissional: 'indefinido',
              abertura: 'indefinido',
              consentimento: false,
              cadencia_dias: 30,
            })
            if (baseError) {
              toast.error('Erro ao mover para a Base Ativa: ' + baseError.message)
            } else {
              toast.success('Feedback enviado! Candidato movido para a Base Ativa.')
            }
          } else {
            toast.success('Feedback enviado! Candidato movido para a Base Ativa.')
          }
        } else {
          toast.success('Feedback enviado! Candidato movido para a Base Ativa.')
        }
      } else {
        toast.success('Status atualizado!')
      }
      updateLocalCandidate(id, { status: newStatus })
      refreshMetadata()
      loadBaseAtiva()
      if (prevStatus === 'inativo' && newStatus !== 'inativo') {
        loadInactiveCandidates()
      }
    } catch {
      toast.error('Erro ao atualizar status. Tente novamente.')
    }
  }

  const baseCandidatoIds = useMemo(() => {
    const ids = new Set<string>()
    for (const b of baseAtiva) {
      if (b.candidato_id) ids.add(b.candidato_id)
    }
    return ids
  }, [baseAtiva])

  const visibleCandidates = useMemo(
    () => candidates.filter((c) => c.status !== 'inativo'),
    [candidates],
  )

  const filteredBase = baseAtiva.filter((b) => {
    if (nivelFiltro !== 'all' && b.nivel !== nivelFiltro) return false
    if (nichoFiltro && !b.nicho?.toLowerCase().includes(nichoFiltro.toLowerCase())) return false
    if (search && !b.nome?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const isBaseEmpty = baseAtiva.length === 0
  const hasActiveFilters = selectedPhases.size > 0 || selectedJobs.size > 0

  if (!activeTenantId) {
    return (
      <div className="p-8 text-center text-muted-foreground">Selecione um tenant em Contas</div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Candidatos & Base Ativa"
        subtitle="Gestão visual, CRM ativo e feedback automatizado."
      >
        <Button variant="outline" asChild>
          <Link to="/conversas?ctx=follow_up">
            <MessageSquare className="w-4 h-4 mr-2" />
            Conversas de follow-up
          </Link>
        </Button>
        <ImportModal
          tenantId={tenantId}
          onSuccess={() => {
            loadBaseAtiva()
            refreshMetadata()
          }}
        />
      </PageHeader>

      {!isBaseEmpty && <BaseAtivaSummary baseAtiva={baseAtiva} />}

      <div className="flex flex-col md:flex-row gap-6">
        <FilterSidebar
          search={search}
          setSearch={setSearch}
          nivel={nivelFiltro}
          setNivel={setNivelFiltro}
          nicho={nichoFiltro}
          setNicho={setNichoFiltro}
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {FUNNEL_PHASES.map((phase) => {
              const isActive = selectedPhases.has(phase.id)
              const count = phaseCounts[phase.id] || 0
              return (
                <button
                  key={phase.id}
                  onClick={() => togglePhase(phase.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', phase.dotClass)} />
                  {phase.label}
                  <span
                    className={cn(
                      'text-[10px] font-bold',
                      isActive ? 'text-primary' : 'text-slate-400',
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {jobOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {jobOptions.map((job) => {
                const isActive = selectedJobs.has(job.id)
                return (
                  <button
                    key={job.id}
                    onClick={() => toggleJob(job.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      isActive
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {job.titulo}
                    <span
                      className={cn(
                        'text-[10px] font-bold',
                        isActive ? 'text-indigo-500' : 'text-slate-400',
                      )}
                    >
                      {job.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {hasActiveFilters && (
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                <X className="w-3 h-3 mr-1" /> Limpar filtros
              </Button>
            </div>
          )}

          <Tabs defaultValue="candidatos" className="w-full">
            <TabsList className="mb-6 w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger
                value="candidatos"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
              >
                Processos Ativos ({totalCount})
              </TabsTrigger>
              <TabsTrigger
                value="base"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
              >
                Base Ativa ({filteredBase.length})
              </TabsTrigger>
              <TabsTrigger
                value="inativos"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
              >
                Inativos ({inactiveCandidates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="candidatos" className="m-0 focus-visible:outline-none">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CandidateCardSkeleton key={i} />
                  ))}
                </div>
              ) : visibleCandidates.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {visibleCandidates.map((cand) => (
                      <CandidateCard
                        key={cand.id}
                        cand={cand}
                        onUpdateStatus={updateStatus}
                        tenantId={tenantId}
                        alreadyInBase={baseCandidatoIds.has(cand.id)}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <p className="text-xs text-slate-400">
                      {visibleCandidates.length} de {totalCount} candidatos
                    </p>
                    {hasMore && (
                      <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Carregando...
                          </>
                        ) : (
                          'Carregar mais'
                        )}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 border rounded-xl bg-slate-50 text-slate-500">
                  Nenhum candidato encontrado com os filtros atuais.
                </div>
              )}
            </TabsContent>

            <TabsContent value="base" className="m-0 focus-visible:outline-none">
              {loadingBase ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TalentCardSkeleton key={i} />
                  ))}
                </div>
              ) : isBaseEmpty ? (
                <div className="text-center py-16 border rounded-xl bg-gradient-to-br from-indigo-50/50 via-white to-emerald-50/50">
                  <div className="flex flex-col items-center max-w-md mx-auto px-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
                      <Users className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                      Sua Base Ativa está vazia
                    </h3>
                    <p className="text-sm text-slate-600 mb-1 leading-relaxed">
                      A Base Ativa guarda talentos para relacionamento contínuo: o agente (e você)
                      fazem follow-up na cadência que você definir.
                    </p>
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      <Sparkles className="w-3.5 h-3.5 inline-block mr-1 text-amber-500" />
                      Inclua candidatos do funil pelo botão no card deles, ou importe uma lista.
                    </p>
                    <ImportModal tenantId={tenantId} onSuccess={loadBaseAtiva} />
                  </div>
                </div>
              ) : filteredBase.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredBase.map((talent) => (
                    <TalentCard key={talent.id} talent={talent} onRefresh={loadBaseAtiva} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-xl bg-slate-50 text-slate-500">
                  <p className="mb-3">Nenhum talento com esses filtros.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNivelFiltro('all')
                      setNichoFiltro('')
                      setSearch('')
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-3 h-3 mr-1" /> Limpar filtros
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="inativos" className="m-0 focus-visible:outline-none">
              {loadingInactive ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <CandidateCardSkeleton key={i} />
                  ))}
                </div>
              ) : inactiveCandidates.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {inactiveCandidates.map((cand) => (
                    <Card key={cand.id} className="flex flex-col h-full opacity-75">
                      <CardContent className="flex-1 pt-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-3">
                            <Avatar className="h-12 w-12 bg-muted">
                              <AvatarImage src={cand.foto_url || undefined} />
                              <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                                {getInitials(cand.nome)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-bold text-lg leading-tight">{cand.nome}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {cand.vagas?.titulo || 'Sem Vaga Vinculada'}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Inativo
                          </Badge>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-slate-50 border-t p-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => reactivateCandidate(cand.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reativar
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                          <Link to={`/candidatos/${cand.id}`}>Ver Perfil</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-xl bg-slate-50 text-slate-500">
                  <Archive className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                  Nenhum candidato inativo.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
