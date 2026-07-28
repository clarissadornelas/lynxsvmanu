import { useState, useEffect, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  AlertTriangle,
  Copy,
  Database,
  Trash2,
  Pencil,
  Loader2,
  Pause,
  Play,
  Archive,
  UserPlus,
  RotateCcw,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { JobFunnelSummary } from '@/components/JobFunnelSummary'
import { useJobOperations } from '@/hooks/use-job-operations'
import { CvIngest } from '@/components/CvIngest'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { JobAvailabilitySection } from '@/components/job-availability/JobAvailabilitySection'
import { DangerZone } from '@/components/DangerZone'

interface Props {
  jobId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  pausada: 'Pausada',
  fechada: 'Fechada',
  arquivada: 'Arquivada',
}

const STATUS_COLORS: Record<string, string> = {
  aberta: 'bg-emerald-100 text-emerald-700',
  pausada: 'bg-amber-100 text-amber-700',
  fechada: 'bg-slate-200 text-slate-600',
  arquivada: 'bg-slate-300 text-slate-700',
}

export function JobProfileSheet({ jobId, open, onOpenChange }: Props) {
  const { jobs, candidates, reload } = useRecruitmentStore()
  const { dependencies, loading, checkDependencies, updateJob, deleteJob } = useJobOperations()

  const job = useMemo(() => jobs.find((j) => j.id === jobId), [jobs, jobId])
  const jobCandidates = useMemo(
    () => candidates.filter((c) => c.jobId === jobId),
    [candidates, jobId],
  )

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    empresa: '',
    cargo: '',
    status: 'aberta',
    data_limite: '',
    salario_min: '',
    salario_max: '',
    salario_moeda: 'BRL',
    salario_nao_declarado: false,
  })

  const isDuplicate = useMemo(() => {
    if (!job) return false
    return jobs.some((j) => j.id !== job.id && j.title === job.title && j.tenantId === job.tenantId)
  }, [job, jobs])

  const isSeed = useMemo(() => {
    if (!job) return false
    const code = (job.codigo || '').toLowerCase()
    return code.includes('seed') || code.includes('teste') || code.includes('demo')
  }, [job])

  const isEmpty = jobCandidates.length === 0
  const canDelete =
    dependencies.candidatos === 0 &&
    dependencies.agendamentos === 0 &&
    dependencies.entrevistas === 0

  useEffect(() => {
    if (open && jobId) {
      checkDependencies(jobId)
      setIsEditing(false)
    }
  }, [open, jobId, checkDependencies])

  useEffect(() => {
    if (open && job) {
      setForm({
        titulo: job.title,
        descricao: job.description,
        empresa: job.company,
        cargo: job.cargo,
        status: job.status,
        data_limite: job.dataLimite || '',
        salario_min: job.salarioMin != null ? String(job.salarioMin) : '',
        salario_max: job.salarioMax != null ? String(job.salarioMax) : '',
        salario_moeda: job.salarioMoeda || 'BRL',
        salario_nao_declarado: job.salarioMin == null && job.salarioMax == null,
      })
    }
  }, [open, job])

  const handleSave = async () => {
    if (!jobId) return

    const salarioMin = form.salario_nao_declarado
      ? null
      : form.salario_min
        ? Number(form.salario_min)
        : null
    const salarioMax = form.salario_nao_declarado
      ? null
      : form.salario_max
        ? Number(form.salario_max)
        : null

    if (
      !form.salario_nao_declarado &&
      salarioMin !== null &&
      salarioMax !== null &&
      salarioMin > salarioMax
    ) {
      toast.error('Salário mínimo não pode ser maior que o salário máximo.')
      return
    }

    const { error } = await updateJob(jobId, {
      titulo: form.titulo,
      descricao: form.descricao,
      empresa: form.empresa,
      cargo: form.cargo,
      status: form.status,
      data_limite: form.data_limite || null,
      salario_min: salarioMin,
      salario_max: salarioMax,
      salario_moeda: form.salario_moeda,
    })
    if (error) {
      toast.error('Erro ao atualizar vaga')
    } else {
      toast.success('Vaga atualizada com sucesso')
      setIsEditing(false)
      await reload()
    }
  }

  const handleStatusShortcut = async (newStatus: string) => {
    if (!jobId) return
    const { error } = await updateJob(jobId, { status: newStatus })
    if (error) {
      toast.error('Erro ao atualizar status')
    } else {
      toast.success(`Status alterado para "${STATUS_LABELS[newStatus] || newStatus}"`)
      setForm((f) => ({ ...f, status: newStatus }))
      await reload()
    }
  }

  const handleDelete = async () => {
    if (!jobId || !canDelete) return
    const { error } = await deleteJob(jobId)
    if (error) {
      toast.error('Erro ao apagar vaga')
    } else {
      toast.success('Vaga apagada com sucesso')
      await reload()
      onOpenChange(false)
    }
  }

  if (!job) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Perfil da Vaga</SheetTitle>
          <SheetDescription className="sr-only">Detalhes e gerenciamento da vaga</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-4 pb-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{job.title}</h3>
              <Badge className={STATUS_COLORS[job.status] || 'bg-slate-100'}>
                {STATUS_LABELS[job.status] || job.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-400">Cliente: </span>
                <span className="font-medium text-slate-700">{job.tenantName}</span>
              </div>
              <div>
                <span className="text-slate-400">Empresa: </span>
                <span className="font-medium text-slate-700">{job.company || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Cargo: </span>
                <span className="font-medium text-slate-700">{job.cargo || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Prazo: </span>
                <span className="font-medium text-slate-700">
                  {job.dataLimite ? new Date(job.dataLimite).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Saúde da vaga</h4>
            <p className="text-xs text-slate-500">
              Total de candidatos:{' '}
              <span className="font-bold text-slate-700">{jobCandidates.length}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {isEmpty && (
                <Badge className="bg-red-50 text-red-600 gap-1">
                  <AlertTriangle className="w-3 h-3" /> Vazia
                </Badge>
              )}
              {isDuplicate && (
                <Badge className="bg-orange-50 text-orange-600 gap-1">
                  <Copy className="w-3 h-3" /> Duplicada
                </Badge>
              )}
              {isSeed && (
                <Badge className="bg-blue-50 text-blue-600 gap-1">
                  <Database className="w-3 h-3" /> Seed
                </Badge>
              )}
              {!isEmpty && !isDuplicate && !isSeed && (
                <Badge className="bg-emerald-50 text-emerald-600">Saudável</Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Funil de candidatos</h4>
            <JobFunnelSummary candidates={jobCandidates} />
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">Editar vaga</h4>
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa</Label>
                  <Input
                    id="empresa"
                    value={form.empresa}
                    onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="data_limite">Prazo</Label>
                <Input
                  id="data_limite"
                  type="date"
                  value={form.data_limite}
                  onChange={(e) => setForm({ ...form, data_limite: e.target.value })}
                />
              </div>

              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Faixa Salarial</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="salario_nd"
                      checked={form.salario_nao_declarado}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, salario_nao_declarado: checked === true })
                      }
                    />
                    <Label htmlFor="salario_nd" className="text-xs text-slate-500 cursor-pointer">
                      Faixa salarial não declarada
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Salário mínimo</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      disabled={form.salario_nao_declarado}
                      value={form.salario_min}
                      onChange={(e) => setForm({ ...form, salario_min: e.target.value })}
                      className={form.salario_nao_declarado ? 'opacity-50' : ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Salário máximo</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      disabled={form.salario_nao_declarado}
                      value={form.salario_max}
                      onChange={(e) => setForm({ ...form, salario_max: e.target.value })}
                      className={form.salario_nao_declarado ? 'opacity-50' : ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Moeda</Label>
                    <Select
                      value={form.salario_moeda}
                      onValueChange={(v) => setForm({ ...form, salario_moeda: v })}
                      disabled={form.salario_nao_declarado}
                    >
                      <SelectTrigger className={form.salario_nao_declarado ? 'opacity-50' : ''}>
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
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={loading} className="flex-1">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pencil className="w-4 h-4" />
                  )}{' '}
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Editar vaga
            </Button>
          )}

          {job.id && job.tenantId && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-semibold text-slate-700">
                    Adicionar candidatos via CV
                  </h4>
                </div>
                <CvIngest
                  vagaId={job.id}
                  tenantId={job.tenantId}
                  onDone={() => {
                    reload()
                  }}
                />
              </div>
            </>
          )}

          {job.id && (
            <>
              <Separator />
              <JobAvailabilitySection
                jobId={job.id}
                initialJanela={job.janela}
                initialMaxAgendamentos={job.maxAgendamentos}
              />
            </>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t pt-4">
          {job.status !== 'pausada' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusShortcut('pausada')}
              disabled={loading}
            >
              <Pause className="w-4 h-4" /> Pausar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusShortcut('aberta')}
              disabled={loading}
            >
              <Play className="w-4 h-4" /> Reativar
            </Button>
          )}
          {job.status !== 'arquivada' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusShortcut('arquivada')}
              disabled={loading}
            >
              <Archive className="w-4 h-4" /> Inativar Vaga
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusShortcut('aberta')}
              disabled={loading}
            >
              <RotateCcw className="w-4 h-4" /> Reativar Vaga
            </Button>
          )}
          <div className="flex-1" />
          {canDelete ? (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}{' '}
              Apagar
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled
                  className="opacity-50 cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" /> Apagar
                </Button>
              </TooltipTrigger>
              <TooltipContent>arquive em vez de apagar</TooltipContent>
            </Tooltip>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
