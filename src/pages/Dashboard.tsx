import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { ExpandableJobCard } from '@/components/ExpandableJobCard'
import { JobProfileSheet } from '@/components/JobProfileSheet'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Users, Briefcase, TrendingUp, Plus } from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { PageHeader } from '@/components/PageHeader'
import { PrecisaDeVoce } from '@/components/dashboard/PrecisaDeVoce'

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

  const kpis = useMemo(() => {
    const inInterview = candidates.filter(
      (c) => c.status === 'em_teste' || c.status === 'entrevistado',
    ).length
    const hired = candidates.filter((c) => c.status === 'contratado').length
    return {
      totalJobs: jobs.length,
      totalCandidates: candidates.length,
      inInterview,
      hired,
    }
  }, [jobs, candidates])

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Vagas no acervo"
          value={kpis.totalJobs}
          icon={Briefcase}
          tooltip="Total de vagas cadastradas no sistema"
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-slate-900"
        />
        <MetricCard
          title="Candidatos"
          value={kpis.totalCandidates}
          icon={Users}
          tooltip="Total de candidatos no pipeline de recrutamento"
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-slate-900"
        />
        <MetricCard
          title="Em entrevista/teste"
          value={kpis.inInterview}
          icon={TrendingUp}
          tooltip="Candidatos atualmente em processo de entrevista ou teste"
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-slate-900"
        />
        <MetricCard
          title="Contratados"
          value={kpis.hired}
          icon={TrendingUp}
          tooltip="Candidatos que foram contratados com sucesso"
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-amber-600"
        />
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
