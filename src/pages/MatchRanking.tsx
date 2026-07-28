import { useParams, Link } from 'react-router-dom'
import { useRecruitment } from '@/stores/use-recruitment'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Trello, Brain, Briefcase, GraduationCap, Users } from 'lucide-react'

export default function MatchRanking() {
  const { jobId } = useParams()
  const { jobs, candidates } = useRecruitment()
  const job = jobs.find((j) => j.id === jobId) || jobs[0] // fallback for demo

  const jobCandidates = candidates
    .filter((c) => c.jobId === job?.id)
    .sort((a, b) => b.matchScore - a.matchScore)

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success'
    if (score >= 75) return 'text-warning'
    return 'text-destructive'
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Análise de Match - {job?.title}</h2>
          <p className="text-muted-foreground">
            Ranking inteligente baseado nos requisitos da vaga.
          </p>
        </div>
        <Link to={`/vagas/${job?.id}/kanban`}>
          <Button>
            <Trello className="mr-2 h-4 w-4" /> Ir para Kanban
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {jobCandidates.map((cand, index) => (
          <Sheet key={cand.id}>
            <SheetTrigger asChild>
              <Card className="hover:border-primary/50 cursor-pointer transition-colors group">
                <CardContent className="p-4 sm:p-6 flex items-center gap-6">
                  <div className="flex-shrink-0 text-2xl font-bold text-muted-foreground w-8">
                    #{index + 1}
                  </div>
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={cand.avatarUrl || undefined} />
                    <AvatarFallback>{cand.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
                      {cand.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {cand.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="hidden md:flex gap-8 flex-1">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Técnico</span> <span>{cand.scores.technical}%</span>
                      </div>
                      <Progress value={cand.scores.technical} className="h-1.5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Cultura</span> <span>{cand.scores.cultural}%</span>
                      </div>
                      <Progress value={cand.scores.cultural} className="h-1.5" />
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`text-2xl font-bold ${getScoreColor(cand.matchScore)}`}>
                      {cand.matchScore}%
                    </div>
                    <div className="text-xs text-muted-foreground">Match Total</div>
                  </div>
                </CardContent>
              </Card>
            </SheetTrigger>

            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>Análise Detalhada</SheetTitle>
              </SheetHeader>
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={cand.avatarUrl || undefined} />
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{cand.name}</h2>
                    <p className="text-muted-foreground">
                      {cand.email} • {cand.phone}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" /> Breakdown do Score
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <Briefcase className="h-3 w-3" /> Experiência
                        </span>{' '}
                        {cand.scores.experience}%
                      </div>
                      <Progress value={cand.scores.experience} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <GraduationCap className="h-3 w-3" /> Técnico
                        </span>{' '}
                        {cand.scores.technical}%
                      </div>
                      <Progress value={cand.scores.technical} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <Users className="h-3 w-3" /> Cultura
                        </span>{' '}
                        {cand.scores.cultural}%
                      </div>
                      <Progress value={cand.scores.cultural} />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg border">
                  <h4 className="font-semibold mb-2 text-sm">Resumo da IA</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cand.name} apresenta um excelente fit técnico para a vaga, dominando as
                    principais ferramentas solicitadas. O alinhamento cultural é forte, demonstrando
                    proatividade e experiência em times ágeis. Ponto de atenção apenas no tempo de
                    experiência específica em liderança técnica.
                  </p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ))}
      </div>
    </div>
  )
}
