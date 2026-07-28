import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VagaOption } from '@/services/relatorios'

interface ReportFiltersProps {
  vagas: VagaOption[]
  selectedVaga: string | null
  onVagaChange: (vagaId: string | null) => void
  daysWindow: number
  onDaysWindowChange: (days: number) => void
}

export function ReportFilters({
  vagas,
  selectedVaga,
  onVagaChange,
  daysWindow,
  onDaysWindowChange,
}: ReportFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Select
        value={selectedVaga || 'all'}
        onValueChange={(v) => onVagaChange(v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Todas as vagas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as vagas</SelectItem>
          {vagas.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.titulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(daysWindow)} onValueChange={(v) => onDaysWindowChange(Number(v))}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="30">Últimos 30 dias</SelectItem>
          <SelectItem value="90">Últimos 90 dias</SelectItem>
          <SelectItem value="365">Últimos 365 dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
