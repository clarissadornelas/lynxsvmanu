import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'
import { UploadCloud, Search, Loader2 } from 'lucide-react'
import { useRecruitment } from '@/stores/use-recruitment'

export default function JobSetup() {
  const { addJob, addCandidates } = useRecruitment()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isSearching, setIsSearching] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const { register, handleSubmit, setValue } = useForm()

  const handleCultureSearch = () => {
    setIsSearching(true)
    setTimeout(() => {
      setValue('culture', 'Inovação, foco no cliente, trabalho em equipe ágil, resiliência.')
      setIsSearching(false)
      toast({
        title: 'Cultura analisada!',
        description: 'Valores da empresa extraídos com sucesso.',
      })
    }, 1500)
  }

  const onSubmit = (data: any) => {
    if (!data.title)
      return toast({ title: 'Erro', description: 'Preencha o cargo.', variant: 'destructive' })
    setIsUploading(true)
    let prog = 0
    const interval = setInterval(() => {
      prog += 25
      setUploadProgress(prog)
      if (prog >= 100) {
        clearInterval(interval)
        const jobId = `job-${Date.now()}`
        addJob({ id: jobId, title: data.title, company: data.company, status: 'active' })

        // Mock new analyzed candidates
        addCandidates([
          {
            id: `c-${Date.now()}-1`,
            jobId,
            name: 'Pedro Alves',
            email: 'pedro@ex.com',
            phone: '11912345678',
            matchScore: 89,
            scores: { experience: 90, technical: 85, cultural: 95, seniority: 88 },
            status: 'analise',
            skills: ['Figma', 'React'],
          },
          {
            id: `c-${Date.now()}-2`,
            jobId,
            name: 'Lucia Gomes',
            email: 'lucia@ex.com',
            phone: '11987654321',
            matchScore: 72,
            scores: { experience: 70, technical: 80, cultural: 60, seniority: 75 },
            status: 'analise',
            skills: ['Vue', 'Node'],
          },
        ])

        toast({ title: 'Sucesso!', description: 'Vaga criada e currículos analisados.' })
        navigate(`/vagas/${jobId}/ranking`)
      }
    }, 600)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Nova Vaga & Upload</h2>
        <p className="text-muted-foreground">
          Configure os parâmetros da vaga e envie os currículos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Vaga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Cargo</Label>
                <Input placeholder="Ex: Desenvolvedor Senior" {...register('title')} />
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input placeholder="Nome da empresa" {...register('company')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Requisitos Técnicos</Label>
              <Textarea
                placeholder="Descreva as skills necessárias..."
                {...register('requirements')}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Perfil Cultural</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCultureSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Pesquisar Cultura
                </Button>
              </div>
              <Textarea placeholder="Traços culturais desejados..." {...register('culture')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload de Currículos (PDF)</CardTitle>
            <CardDescription>Arraste ou clique para enviar até 10 currículos.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isUploading ? (
              <div className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium">
                  Clique para selecionar ou arraste os PDFs aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">Máximo 10 arquivos</p>
              </div>
            ) : (
              <div className="space-y-4 py-8">
                <div className="flex justify-between text-sm">
                  <span>Analisando currículos com IA...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isUploading}>
            Iniciar Análise e Ranking
          </Button>
        </div>
      </form>
    </div>
  )
}
