import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { ExpandableJobCard } from '@/components/ExpandableJobCard'
import { JobProfileSheet } from '@/components/JobProfileSheet'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { PrecisaDeVoce } from '@/components/dashboard/PrecisaDeVoce'
import { KANBAN_COLUMNS, deriveKanbanColumn, parseEtapas, COR_FASE } from '@/lib/funnel-phases'
import type { KanbanColumnId } from '@/lib/funnel-phases'

export default function Dashboard() {
  const { jobs, candidates, loading, reload } = useRecruitmentStore()
  const navigate = useNavigate()

  const [profileJobId, setProfileJobId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleJobClick = useCallback((jobId: string) => {
    setProfileJobId(jobId)
    setProfileOpen(true)
  }, [])

  const handleProfileOpenChange = useCallback((open: boolean) => {
    setProfileOpen(open)
    if (!open) setProfileJobId(null)
  }, [])

  useEffect(() => {
    reload().catch((err) => {
      console.error('Failed to reload recruitment data:', err)
    })
  }, [reload])

  const tenantGroups = useMemo(() => {
    const map = new Map<string, { tenantName: string; jobs: typeof jobs }>()
    for (const job of jobs) {
      const key = job.tenantName
      if (!map.has(key)) {
        map.set(key, { tenantName: key, jobs: [] })
      }
      map.get(key)!.jobs.push(job)
    }
    return Array.from(map.values())
  }, [jobs])

  const funil = useMemo(() => {
    const porColuna = {} as Record<KanbanColumnId, number>
    for (const col of KANBAN_COLUMNS) {
      porColuna[col.id] = 0
    }
    const ativos = candidates.filter((c) => c.situacao !== 'eliminado')
    for (const c of ativos) {
      const job = jobs.find((j) => j.id === c.jobId)
      const totalRodadas = job ? parseEtapas(job.etapas).length : 0
      const col = deriveKanbanColumn(
        c.status,
        c.etapaAtual,
        totalRodadas,
        c.shortlistOrdem,
        c.faseSaida,
      )
      porColuna[col] += 1
    }
    return { ativos: ativos.length, porColuna }
  }, [jobs, candidates])

  const kpis = useMemo(() => {
    const vagasAbertas = jobs.filter((j) => j.status === 'aberta').length
    const contratados = candidates.filter((c) => c.status === 'contratado').length
    return {
      vagasAbertas,
      totalJobs: jobs.length,
      ativos: funil.ativos,
      contratados,
    }
  }, [jobs, candidates, funil])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader
        title="Painel Unificado"
        subtitle="Visão global de vagas, candidatos e progressão no pipeline de recrutamento."
      >
        <Button className="gap-2" onClick={() => navigate('/vagas/nova')}>
          <Plus className="w-4 h-4" />
          Nova Vaga
        </Button>
      </PageHeader>

      <PrecisaDeVoce />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          className="flex flex-col items-start gap-1 p-5 rounded-xl border border-slate-200 bg-white text-left transition-colors hover:bg-slate-50"
          onClick={() => navigate('/vagas')}
        >
          <span className="text-sm text-slate-500">Vagas abertas</span>
          <span className="text-3xl font-bold text-slate-900">{kpis.vagasAbertas}</span>
          <span className="text-xs text-slate-400">de {kpis.totalJobs} no acervo</span>
        </button>
        <button
          className="flex flex-col items-start gap-1 p-5 rounded-xl border border-slate-200 bg-white text-left transition-colors hover:bg-slate-50"
          onClick={() => navigate('/candidatos')}
        >
          <span className="text-sm text-slate-500">Candidatos ativos no funil</span>
          <span className="text-3xl font-bold text-slate-900">{kpis.ativos}</span>
          <span className="text-xs text-slate-400">quem saiu fica fora da conta</span>
        </button>
        <div className="flex flex-col items-start gap-1 p-5 rounded-xl border border-slate-200 bg-white">
          <span className="text-sm text-slate-500">Contratados</span>
          <span className="text-3xl font-bold text-amber-600">{kpis.contratados}</span>
          <span className="text-xs text-slate-400">fecharam vaga</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Funil consolidado</h3>
            <span className="text-sm text-slate-400">{funil.ativos} ativos</span>
          </div>
          <span className="text-xs text-slate-400">clique num trecho para abrir a lista</span>
        </div>
        <div className="flex w-full gap-1 h-10">
          {KANBAN_COLUMNS.map((col) => {
            const count = funil.porColuna[col.id]
            const bg = count > 0 ? COR_FASE[col.id] : '#F1EEEB'
            const flex = funil.ativos > 0 ? Math.max(count, 0) : 1
            return (
              <button
                key={col.id}
                className="flex items-center justify-center rounded-md text-xs font-semibold transition-opacity hover:opacity-80 min-w-[2rem]"
                style={{
                  backgroundColor: bg,
                  flex: funil.ativos > 0 ? flex : 1,
                  color: count > 0 ? '#fff' : '#999',
                }}
                onClick={() => navigate(`/candidatos?coluna=${col.id}`)}
              >
                {count > 0 ? count : ''}
              </button>
            )
          })}
        </div>
        <div className="flex w-full gap-1 mt-1.5">
          {KANBAN_COLUMNS.map((col) => {
            const count = funil.porColuna[col.id]
            const flex = funil.ativos > 0 ? Math.max(count, 0) : 1
            return (
              <span
                key={col.id}
                className="text-[10px] leading-tight text-center text-slate-500 min-w-[2rem]"
                style={{ flex: funil.ativos > 0 ? flex : 1 }}
              >
                {col.label}
              </span>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Vagas por cliente</h3>
        {tenantGroups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-500">
              Nenhuma vaga encontrada.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {tenantGroups.map((group) => (
              <div key={group.tenantName} className="space-y-3">
                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                  {group.tenantName}
                </h4>
                {group.jobs.map((job) => {
                  const jobCandidates = candidates.filter((c) => c.jobId === job.id)
                  return (
                    <ExpandableJobCard
                      key={job.id}
                      job={job}
                      candidates={jobCandidates}
                      onJobClick={handleJobClick}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <JobProfileSheet
        jobId={profileJobId}
        open={profileOpen}
        onOpenChange={handleProfileOpenChange}
      />
    </div>
  )
}
