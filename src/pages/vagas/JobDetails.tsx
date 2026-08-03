import { useParams, Link, useSearchParams } from 'react-router-dom'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EditorRodadas from '@/components/vaga/EditorRodadas'
import { parseEtapas, deriveKanbanColumn } from '@/lib/funnel-phases'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CvIngest } from '@/components/CvIngest'
import { JobAvailabilitySection } from '@/components/job-availability/JobAvailabilitySection'
import { useJobOperations } from '@/hooks/use-job-operations'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Save } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import RankingTab from './components/RankingTab'
import ShortlistTab from './components/ShortlistTab'
import KanbanTab from './components/KanbanTab'

export default function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { jobs, candidates, reload } = useRecruitmentStore()
  const ABAS_VALIDAS = ['kanban', 'decisao', 'info'] as const
  const resolverAba = (valor: string | null) =>
    ABAS_VALIDAS.includes(valor as (typeof ABAS_VALIDAS)[number]) ? valor! : 'kanban'
  const [abaAtiva, setAbaAtiva] = useState(resolverAba(searchParams.get('tab')))
  useEffect(() => {
    setAbaAtiva(resolverAba(searchParams.get('tab')))
  }, [searchParams])
  const trocarAba = (valor: string) => {
    setAbaAtiva(valor)
    setSearchParams({ tab: valor }, { replace: true })
  }

  const { updateJob, loading: salvandoVaga } = useJobOperations()
  const job = jobs.find((j) => j.id === id)
  const jobCandidates = candidates.filter((c) => c.jobId === id && c.status !== 'inativo')

  const [form, setForm] = useState({
    titulo: '',
    empresa: '',
    cargo: '',
    descricao: '',
    data_limite: '',
    status: 'aberta',
    salario_min: '',
    salario_max: '',
    salario_moeda: 'BRL',
    salario_nao_declarado: false,
  })
  const [formIniciado, setFormIniciado] = useState(false)

  if (!job) {
    return <div className="p-8 text-center text-slate-500">Vaga não encontrada.</div>
  }

  if (!formIniciado) {
    setForm({
      titulo: job.title || '',
      empresa: job.company || '',
      cargo: (job as unknown as { cargo?: string }).cargo || '',
      descricao: job.description || '',
      data_limite: job.dataLimite ? job.dataLimite.slice(0, 10) : '',
      status: job.status || 'aberta',
      salario_min: job.salarioMin != null ? String(job.salarioMin) : '',
      salario_max: job.salarioMax != null ? String(job.salarioMax) : '',
      salario_moeda: (job as unknown as { salarioMoeda?: string }).salarioMoeda || 'BRL',
      salario_nao_declarado: job.salarioMin == null && job.salarioMax == null,
    })
    setFormIniciado(true)
  }

  const salvarDadosDaVaga = async () => {
    const nd = form.salario_nao_declarado
    const { error } = await updateJob(job.id, {
      titulo: form.titulo,
      empresa: form.empresa,
      cargo: form.cargo,
      descricao: form.descricao,
      data_limite: form.data_limite || null,
      status: form.status,
      salario_min: nd || !form.salario_min ? null : Number(form.salario_min),
      salario_max: nd || !form.salario_max ? null : Number(form.salario_max),
      salario_moeda: nd ? null : form.salario_moeda,
    })
    if (error) {
      toast.error('Não foi possível salvar os dados da vaga.')
      return
    }
    toast.success('Dados da vaga salvos.')
    reload()
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
      </PageHeader>

      <Tabs
        value={abaAtiva}
        onValueChange={trocarAba}
        className="flex-1 flex flex-col overflow-hidden"
      >
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
            <ShortlistTab candidates={jobCandidates} jobId={job.id} />
          </TabsContent>
          <TabsContent
            value="info"
            className="m-0 bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl"
          >
            <h3 className="font-semibold text-lg mb-4">Dados da vaga</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="space-y-1.5">
                <Label htmlFor="vaga-titulo">Título</Label>
                <Input
                  id="vaga-titulo"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vaga-empresa">Empresa</Label>
                <Input
                  id="vaga-empresa"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vaga-cargo">Cargo</Label>
                <Input
                  id="vaga-cargo"
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="vaga-descricao">Descrição</Label>
                <Textarea
                  id="vaga-descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vaga-prazo">Prazo</Label>
                <Input
                  id="vaga-prazo"
                  type="date"
                  value={form.data_limite}
                  onChange={(e) => setForm({ ...form, data_limite: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vaga-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="vaga-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="pausada">Pausada</SelectItem>
                    <SelectItem value="fechada">Fechada</SelectItem>
                    <SelectItem value="arquivada">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-medium text-sm text-slate-700 mb-3">Faixa salarial</h4>
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex items-center gap-2 order-last sm:order-first">
                  <Checkbox
                    id="vaga-salario-nd"
                    checked={form.salario_nao_declarado}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, salario_nao_declarado: checked === true })
                    }
                  />
                  <Label
                    htmlFor="vaga-salario-nd"
                    className="text-sm text-slate-600 cursor-pointer"
                  >
                    Não declarada
                  </Label>
                </div>
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="vaga-salario-min">Mínimo</Label>
                  <Input
                    id="vaga-salario-min"
                    type="number"
                    value={form.salario_min}
                    disabled={form.salario_nao_declarado}
                    onChange={(e) => setForm({ ...form, salario_min: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="vaga-salario-max">Máximo</Label>
                  <Input
                    id="vaga-salario-max"
                    type="number"
                    value={form.salario_max}
                    disabled={form.salario_nao_declarado}
                    onChange={(e) => setForm({ ...form, salario_max: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 w-full sm:w-32">
                  <Label htmlFor="vaga-salario-moeda">Moeda</Label>
                  <Select
                    value={form.salario_moeda}
                    disabled={form.salario_nao_declarado}
                    onValueChange={(v) => setForm({ ...form, salario_moeda: v })}
                  >
                    <SelectTrigger id="vaga-salario-moeda">
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

            <div className="flex justify-end mb-6">
              <Button onClick={salvarDadosDaVaga} disabled={salvandoVaga} size="sm">
                {salvandoVaga ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar dados da vaga
              </Button>
            </div>

            <h3 className="font-semibold text-lg mb-4">Requisitos mapeados pela IA</h3>
            <div className="whitespace-pre-wrap text-sm text-slate-600 font-mono bg-slate-50 p-4 rounded-lg border border-slate-100">
              {job.requirements}
            </div>
            <div className="border-t border-slate-200 mt-6 pt-6">
              <h3 className="font-semibold text-lg mb-1">Rodadas de entrevista</h3>
              <p className="text-sm text-slate-500 mb-4">
                {parseEtapas(job.etapas).length === 1
                  ? '1 rodada configurada'
                  : `${parseEtapas(job.etapas).length} rodadas configuradas`}
              </p>
              <EditorRodadas
                vagaId={job.id}
                onSalvo={reload}
                etapas={job.etapas}
                candidatosPorRodada={jobCandidates.reduce<Record<number, number>>((acc, c) => {
                  const total = parseEtapas(job.etapas).length
                  const coluna = deriveKanbanColumn(
                    c.status,
                    (c as unknown as { etapaAtual?: number }).etapaAtual,
                    total,
                    (c as unknown as { shortlistOrdem?: number | null }).shortlistOrdem,
                    (c as unknown as { faseSaida?: string | null }).faseSaida,
                  )
                  if (coluna !== 'em_entrevista') return acc
                  const n = (c as unknown as { etapaAtual?: number }).etapaAtual ?? 1
                  acc[n] = (acc[n] ?? 0) + 1
                  return acc
                }, {})}
              />
            </div>

            <div className="border-t border-slate-200 mt-6 pt-6">
              <h3 className="font-semibold text-lg mb-1">Disponibilidade para entrevistas</h3>
              <p className="text-sm text-slate-500 mb-4">
                Janela de horários, máximo por dia e data limite desta vaga.
              </p>
              <JobAvailabilitySection
                jobId={job.id}
                initialJanela={job.janela}
                initialMaxAgendamentos={job.maxAgendamentos}
                initialDataLimite={job.dataLimite}
                onSaved={reload}
              />
            </div>

            <div className="border-t border-slate-200 mt-6 pt-6 pb-8">
              <h3 className="font-semibold text-lg mb-1">Adicionar candidatos via CV</h3>
              <p className="text-sm text-slate-500 mb-4">
                Pode ser feito a qualquer momento enquanto a vaga estiver aberta.
              </p>
              <CvIngest vagaId={job.id} tenantId={job.tenantId} onDone={reload} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
