import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, LayoutList } from 'lucide-react'
import { useRecruitment } from '@/stores/use-recruitment'

export default function Jobs() {
  const { jobs, candidates } = useRecruitment()

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Minhas Vagas</h2>
          <p className="text-muted-foreground">Gerencie suas vagas ativas e encerradas.</p>
        </div>
        <Link to="/vagas/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Criar Vaga
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => {
          const jobCandidates = candidates.filter((c) => c.jobId === job.id)
          return (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <CardDescription>{job.company}</CardDescription>
                  </div>
                  <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>
                    {job.status === 'active' ? 'Ativa' : 'Fechada'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Users className="h-4 w-4" />
                  <span>{jobCandidates.length} candidatos</span>
                </div>
                <div className="flex gap-2">
                  <Link to={`/vagas/${job.id}/ranking`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <LayoutList className="mr-2 h-4 w-4" /> Ranking
                    </Button>
                  </Link>
                  <Link to={`/vagas/${job.id}/kanban`} className="flex-1">
                    <Button className="w-full">Kanban</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
