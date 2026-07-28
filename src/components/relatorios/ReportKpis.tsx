import { MetricCard } from '@/components/MetricCard'
import { Users, CheckCircle2, Percent, Clock, AlertCircle } from 'lucide-react'
import type { KpiData } from '@/lib/report-utils'

export function ReportKpis({ kpis }: { kpis: KpiData }) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Candidatos no período"
          value={kpis.totalCandidates}
          icon={Users}
          tooltip="Candidatos únicos que tiveram um evento criado no período ou foram criados no período."
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-slate-900"
        />
        <MetricCard
          title="Contratados"
          value={kpis.totalHires}
          icon={CheckCircle2}
          tooltip="Eventos com destino 'contratado' dentro do período selecionado."
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-amber-600"
        />
        <MetricCard
          title="Taxa de conversão"
          value={`${kpis.conversionRate.toFixed(1)}%`}
          icon={Percent}
          tooltip="Contratados ÷ Candidatos no período × 100."
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-slate-900"
        />
        <MetricCard
          title="Tempo médio total"
          value={kpis.avgTimeToHire !== null ? `${kpis.avgTimeToHire.toFixed(1)}d` : '—'}
          icon={Clock}
          tooltip="Média de dias entre a criação do candidato e o evento de contratação."
          titleClassName="text-slate-600"
          iconClassName="text-slate-400"
          valueClassName="text-slate-900"
        />
      </div>
      {kpis.smallSample && (
        <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Amostra pequena: números tendem a estabilizar com mais volume.
        </p>
      )}
    </div>
  )
}
