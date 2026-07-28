import { useParams, Link, useSearchParams } from 'react-router-dom'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Share2, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import RankingTab from './components/RankingTab'
import KanbanTab from './components/KanbanTab'

export default function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { jobs, candidates } = useRecruitmentStore()
  const initialTab = searchParams.get('tab') === 'decisao' ? 'decisao' : 'kanban'

  const job = jobs.find((j) => j.id === id)
  const jobCandidates = candidates.filter((c) => c.jobId === id && c.status !== 'inativo')

  if (!job) {
    return <div className="p-8 text-center text-slate-500">Vaga não encontrada.</div>
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <PageHeader
        title={job.title}
        subtitle={`${job.company} • ${jobCandidates.length} Candidatos`}
      >
        <Link to="/vagas">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-slate-900 border border-slate-200 bg-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Button variant="outline" size="sm" className="bg-white">
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar Link
        </Button>
        <Button variant="outline" size="sm" className="bg-white">
          <Settings2 className="w-4 h-4 mr-2" />
          Configurar Job
        </Button>
      </PageHeader>

      <Tabs defaultValue={initialTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="bg-slate-200/50 p-1 w-full sm:w-auto inline-flex justify-start sm:inline-flex shrink-0">
          <TabsTrigger
            value="kanban"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Kanban (Operação)
          </TabsTrigger>
          <TabsTrigger
            value="decisao"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Decisão
          </TabsTrigger>
          <TabsTrigger
            value="info"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Info da Vaga
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden mt-4">
          <TabsContent
            value="kanban"
            className="h-full m-0 border-0 p-0 overflow-x-auto hide-scrollbar"
          >
            <KanbanTab
              candidates={jobCandidates}
              jobId={job.id}
              jobJanela={job.janela}
              jobDataLimite={job.dataLimite}
              jobMaxAgendamentos={job.maxAgendamentos}
            />
          </TabsContent>
          <TabsContent value="decisao" className="h-full m-0 overflow-y-auto">
            <RankingTab candidates={jobCandidates} jobId={job.id} />
          </TabsContent>
          <TabsContent
            value="info"
            className="m-0 bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl"
          >
            <h3 className="font-semibold text-lg mb-4">Requisitos mapeados pela IA</h3>
            <div className="whitespace-pre-wrap text-sm text-slate-600 font-mono bg-slate-50 p-4 rounded-lg border border-slate-100">
              {job.requirements}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
