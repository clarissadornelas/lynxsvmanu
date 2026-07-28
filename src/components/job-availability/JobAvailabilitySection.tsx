import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, Clock } from 'lucide-react'
import { toast } from 'sonner'
import type { JanelaConfig, DayKey, TimeBlock, DateException } from './types'
import { defaultJanela, parseJanela } from './types'
import { WeeklyWindowEditor } from './WeeklyWindowEditor'
import { ExceptionsEditor } from './ExceptionsEditor'
import { SlotPreview } from './SlotPreview'
import { useJobOperations } from '@/hooks/use-job-operations'
import type { Json } from '@/lib/supabase/types'

interface Props {
  jobId: string
  initialJanela: Json | null
  initialMaxAgendamentos: number
  initialDataLimite?: string | null
  onSaved?: (updated: {
    janela: Json | null
    maxAgendamentos: number
    dataLimite: string | null
  }) => void
}

export function JobAvailabilitySection({
  jobId,
  initialJanela,
  initialMaxAgendamentos,
  initialDataLimite,
  onSaved,
}: Props) {
  const { updateJob, loading } = useJobOperations()
  const [config, setConfig] = useState<JanelaConfig>(defaultJanela())
  const [maxAgendamentos, setMaxAgendamentos] = useState(initialMaxAgendamentos)
  const [dataLimite, setDataLimite] = useState<string | null>(initialDataLimite ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setConfig(parseJanela(initialJanela))
    setMaxAgendamentos(initialMaxAgendamentos)
    setDataLimite(initialDataLimite ?? null)
  }, [initialJanela, initialMaxAgendamentos, initialDataLimite])

  const updateSemana = useCallback((semana: Record<DayKey, TimeBlock[]>) => {
    setConfig((prev) => ({ ...prev, semana }))
  }, [])

  const updateExcecoes = useCallback((excecoes: DateException[]) => {
    setConfig((prev) => ({ ...prev, excecoes }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const payload: Record<string, unknown> = {
      janela: config as unknown as Record<string, unknown>,
      max_agendamentos: maxAgendamentos,
    }
    if (dataLimite !== undefined) {
      payload.data_limite = dataLimite || null
    }
    const { error } = await updateJob(jobId, payload)
    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar disponibilidade')
      return
    }
    toast.success('Disponibilidade salva com sucesso!')
    onSaved?.({
      janela: config as unknown as Json,
      maxAgendamentos,
      dataLimite,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-500" />
        <h4 className="text-sm font-semibold text-slate-700">Disponibilidade</h4>
      </div>

      <div className="rounded-md bg-blue-50 border border-blue-200 p-2">
        <p className="text-xs text-blue-700">Fuso da vaga: Brasília (America/Sao_Paulo)</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Duração da entrevista</Label>
          <Select
            value={String(config.duracao_min)}
            onValueChange={(v) => setConfig({ ...config, duracao_min: Number(v) })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="45">45 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Máx. por dia</Label>
          <Input
            type="number"
            min={1}
            value={maxAgendamentos}
            onChange={(e) => setMaxAgendamentos(Number(e.target.value))}
            className="h-8"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Data limite para agendamentos</Label>
        <Input
          type="date"
          value={dataLimite ?? ''}
          onChange={(e) => setDataLimite(e.target.value || null)}
          className="h-8"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-600">Janelas semanais</Label>
        <WeeklyWindowEditor semana={config.semana} onChange={updateSemana} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-600">Exceções de data</Label>
        <ExceptionsEditor excecoes={config.excecoes} onChange={updateExcecoes} />
      </div>

      <SlotPreview config={config} />

      <Button onClick={handleSave} disabled={saving || loading} className="w-full" size="sm">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{' '}
        Salvar disponibilidade
      </Button>
    </div>
  )
}
