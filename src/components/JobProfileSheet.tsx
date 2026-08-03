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
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  AlertTriangle,
  Copy,
  Database,
  Trash2,
  Loader2,
  Pause,
  Play,
  Archive,
  RotateCcw,
  Settings2,
} from 'lucide-react'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { JobFunnelSummary } from '@/components/JobFunnelSummary'
import { useJobOperations } from '@/hooks/use-job-operations'
import { toast } from 'sonner'
import { DangerZone } from '@/components/DangerZone'
import { Link } from 'react-router-dom'
import { parseEtapas } from '@/lib/funnel-phases'

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

  const totalRodadas = useMemo(() => (job ? parseEtapas(job.etapas).length : 0), [job])

  const hasJanela = useMemo(() => {
    if (!job?.janela) return false
    if (
      typeof job.janela === 'object' &&
      Object.keys(job.janela as Record<string, unknown>).length === 0
    )
      return false
    return true
  }, [job])

  const deadlineFormatted = useMemo(() => {
    if (!job?.dataLimite) return 'sem prazo'
    return new Date(job.dataLimite).toLocaleDateString('pt-BR')
  }, [job])

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
            <JobFunnelSummary candidates={jobCandidates} etapas={job.etapas} />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Configuração</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-slate-500">Rodadas</p>
                <p className="text-lg font-bold text-slate-900">
                  {totalRodadas > 0 ? totalRodadas : 'nenhuma'}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-slate-500">Disponibilidade</p>
                <p
                  className={`text-sm font-bold ${hasJanela ? 'text-slate-900' : 'text-orange-600'}`}
                >
                  {hasJanela ? 'configurada' : 'sem janela'}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-slate-500">Prazo</p>
                <p className="text-sm font-bold text-slate-900">{deadlineFormatted}</p>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link to={`/vagas/${jobId}?tab=info`} onClick={() => onOpenChange(false)}>
                <Settings2 className="w-4 h-4 mr-2" />
                Abrir a vaga para configurar
              </Link>
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Título, descrição, prazo, rodadas, perguntas e disponibilidade se editam na aba Info
              da vaga.
            </p>
          </div>
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
