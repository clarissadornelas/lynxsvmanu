import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/PageHeader'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'
import { toast as sonnerToast } from 'sonner'
import { CvIngest } from '@/components/CvIngest'

interface TenantOption {
  id: string
  nome: string
}

export default function JobSetup() {
  const navigate = useNavigate()
  const { reload } = useRecruitmentStore()
  const { toast } = useToast()
  const { tenantId: activeTenantId } = useActiveContext()

  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    description: '',
    requirements: '',
    tenantId: '',
    salarioMin: '',
    salarioMax: '',
    salarioMoeda: 'BRL',
    salarioNaoDeclarado: false,
  })
  const [isResearching, setIsResearching] = useState(false)
  const [researchDone, setResearchDone] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState<1 | 2>(1)
  const [novaVagaId, setNovaVagaId] = useState<string | null>(null)

  useEffect(() => {
    async function loadTenants() {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome', { ascending: true })

      if (error) {
        sonnerToast.error('Erro ao carregar clientes: ' + error.message)
        return
      }
      setTenants(data || [])
    }
    loadTenants()
  }, [])

  useEffect(() => {
    if (activeTenantId) {
      setFormData((prev) => (prev.tenantId ? prev : { ...prev, tenantId: activeTenantId }))
    }
  }, [activeTenantId])

  const handleResearch = () => {
    if (!formData.company) {
      toast({
        title: 'Aviso',
        description: 'Digite o nome da empresa primeiro.',
        variant: 'destructive',
      })
      return
    }
    setIsResearching(true)
    setTimeout(() => {
      setFormData((prev) => ({
        ...prev,
        requirements:
          prev.requirements +
          '\n\n[Cultura da Empresa Extraída]: Foco em inovação, ambiente ágil (Scrum), valoriza autonomia e perfil hands-on.',
      }))
      setIsResearching(false)
      setResearchDone(true)
      toast({
        title: 'Cultura mapeada!',
        description: 'Valores da empresa adicionados aos requisitos.',
      })
    }, 2000)
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.company || !formData.tenantId) {
      toast({
        title: 'Aviso',
        description: 'Preencha cargo, empresa e cliente.',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(10)

    try {
      const { count: countBefore, error: countErrorBefore } = await supabase
        .from('vagas')
        .select('*', { count: 'exact', head: true })

      if (countErrorBefore) {
        toast({
          title: 'Erro',
          description: 'Falha ao contar vagas antes da inserção: ' + countErrorBefore.message,
          variant: 'destructive',
        })
        setIsProcessing(false)
        setProgress(0)
        return
      }

      setProgress(40)

      const salarioMin = formData.salarioNaoDeclarado
        ? null
        : formData.salarioMin
          ? Number(formData.salarioMin)
          : null
      const salarioMax = formData.salarioNaoDeclarado
        ? null
        : formData.salarioMax
          ? Number(formData.salarioMax)
          : null

      if (
        !formData.salarioNaoDeclarado &&
        salarioMin !== null &&
        salarioMax !== null &&
        salarioMin > salarioMax
      ) {
        toast({
          title: 'Aviso',
          description: 'Salário mínimo não pode ser maior que o salário máximo.',
          variant: 'destructive',
        })
        setIsProcessing(false)
        setProgress(0)
        return
      }

      const { data: novaVaga, error: insertError } = await supabase
        .from('vagas')
        .insert({
          titulo: formData.title,
          descricao: formData.description || formData.requirements || '',
          tenant_id: formData.tenantId,
          status: 'aberta',
          empresa: formData.company || null,
          cargo: formData.title || null,
          salario_min: salarioMin,
          salario_max: salarioMax,
          salario_moeda: formData.salarioMoeda,
        })
        .select('id')
        .single()

      if (insertError || !novaVaga) {
        toast({
          title: 'Erro ao criar vaga',
          description: insertError?.message || 'Falha ao criar vaga',
          variant: 'destructive',
        })
        setIsProcessing(false)
        setProgress(0)
        return
      }

      setProgress(70)

      const { count: countAfter, error: countErrorAfter } = await supabase
        .from('vagas')
        .select('*', { count: 'exact', head: true })

      if (countErrorAfter) {
        toast({
          title: 'Erro',
          description: 'Falha ao contar vagas após inserção: ' + countErrorAfter.message,
          variant: 'destructive',
        })
        setIsProcessing(false)
        setProgress(0)
        return
      }

      const before = countBefore ?? 0
      const after = countAfter ?? 0

      if (after - before !== 1) {
        toast({
          title: 'Validação falhou',
          description: `Esperado aumento de 1 vaga, mas aumentou ${after - before}. Operação cancelada.`,
          variant: 'destructive',
        })
        setIsProcessing(false)
        setProgress(0)
        return
      }

      setProgress(100)

      await reload()

      toast({
        title: 'Sucesso!',
        description: 'Vaga criada com sucesso no banco de dados.',
      })

      setNovaVagaId(novaVaga.id)
      setStep(2)
      setIsProcessing(false)
      setProgress(0)
    } catch (err) {
      toast({
        title: 'Erro inesperado',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
      setIsProcessing(false)
      setProgress(0)
    }
  }

  if (step === 2 && novaVagaId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <PageHeader
          title="Nova Vaga"
          subtitle="A vaga foi criada. Adicione candidatos agora ou conclua mais tarde."
        />
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Etapa 2 — Adicionar candidatos via CV (opcional)
            </h2>
            <p className="text-sm text-slate-500">
              A vaga já foi criada. Suba os currículos agora, ou conclua e adicione depois.
            </p>
          </div>
          <CvIngest
            vagaId={novaVagaId}
            tenantId={formData.tenantId}
            onDone={() => navigate(`/vagas/${novaVagaId}`)}
          />
          <Button variant="outline" onClick={() => navigate(`/vagas/${novaVagaId}`)}>
            Concluir sem adicionar candidatos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <PageHeader
        title="Nova Vaga"
        subtitle="Configure os requisitos e deixe a IA fazer o match dos currículos."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Detalhes da Posição</CardTitle>
            <CardDescription>Informações básicas para busca e análise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant">Cliente (Tenant) *</Label>
              <Select
                value={formData.tenantId}
                onValueChange={(value) => setFormData({ ...formData, tenantId: value })}
              >
                <SelectTrigger id="tenant">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Nome do Cargo</Label>
              <Input
                id="title"
                placeholder="Ex: Senior Frontend Engineer"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <div className="flex gap-2">
                <Input
                  id="company"
                  placeholder="Nome da empresa contratante"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
                <Button
                  type="button"
                  variant={researchDone ? 'outline' : 'secondary'}
                  onClick={handleResearch}
                  disabled={isResearching}
                  className="shrink-0"
                >
                  {isResearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : researchDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {researchDone ? 'Cultural Mapeada' : 'Pesquisar Cultura'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição da Vaga</Label>
              <Textarea
                id="description"
                placeholder="Resumo das responsabilidades..."
                className="h-24 resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reqs">Requisitos Técnicos e Soft Skills</Label>
              <Textarea
                id="reqs"
                placeholder="A IA usará isso para criar o Ranking de Match..."
                className="h-32 resize-none bg-indigo-50/50 border-indigo-100"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              />
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Faixa Salarial</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.salarioNaoDeclarado}
                    onChange={(e) =>
                      setFormData({ ...formData, salarioNaoDeclarado: e.target.checked })
                    }
                    className="rounded border-slate-300"
                  />
                  <span className="text-xs text-slate-500">Faixa salarial não declarada</span>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="salarioMin" className="text-xs">
                    Salário mínimo
                  </Label>
                  <Input
                    id="salarioMin"
                    type="number"
                    placeholder="0,00"
                    disabled={formData.salarioNaoDeclarado}
                    value={formData.salarioMin}
                    onChange={(e) => setFormData({ ...formData, salarioMin: e.target.value })}
                    className={formData.salarioNaoDeclarado ? 'opacity-50' : ''}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="salarioMax" className="text-xs">
                    Salário máximo
                  </Label>
                  <Input
                    id="salarioMax"
                    type="number"
                    placeholder="0,00"
                    disabled={formData.salarioNaoDeclarado}
                    value={formData.salarioMax}
                    onChange={(e) => setFormData({ ...formData, salarioMax: e.target.value })}
                    className={formData.salarioNaoDeclarado ? 'opacity-50' : ''}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Moeda</Label>
                  <Select
                    value={formData.salarioMoeda}
                    onValueChange={(v) => setFormData({ ...formData, salarioMoeda: v })}
                    disabled={formData.salarioNaoDeclarado}
                  >
                    <SelectTrigger className={formData.salarioNaoDeclarado ? 'opacity-50' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {isProcessing ? (
            <Card className="bg-indigo-600 text-white shadow-md animate-fade-in-up">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 font-medium">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Criando vaga no banco de dados...
                  </div>
                  <span className="text-sm opacity-80">{progress}%</span>
                </div>
                <Progress
                  value={progress}
                  className="h-2 bg-indigo-800"
                  indicatorClassName="bg-white"
                />
                <p className="text-xs text-indigo-200 mt-3">
                  Validando inserção e recarregando dados do acervo.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Button
              className="w-full h-12 text-lg shadow-sm"
              onClick={handleSubmit}
              disabled={!formData.title || !formData.company || !formData.tenantId}
            >
              Criar Vaga no Banco
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
