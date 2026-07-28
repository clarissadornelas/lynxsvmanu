import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { FunnelPhaseData } from '@/lib/report-utils'

const chartConfig: ChartConfig = {
  count: { label: 'Candidatos' },
}

export function FunnelChart({ data }: { data: FunnelPhaseData[] }) {
  const chartData = data.map((d) => ({
    label: d.label,
    count: d.count,
    color: d.color,
    rateLabel: d.passThroughRate !== null ? `${d.passThroughRate.toFixed(1)}%` : '',
  }))

  return (
    <ChartContainer config={chartConfig} className="w-full h-[350px]">
      <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={4} minPointSize={2}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
          <LabelList dataKey="rateLabel" position="right" className="text-xs fill-slate-500" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
