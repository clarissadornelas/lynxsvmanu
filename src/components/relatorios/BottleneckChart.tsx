import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { BottleneckPhaseData } from '@/lib/report-utils'

const chartConfig: ChartConfig = {
  avgDays: { label: 'Dias' },
}

export function BottleneckChart({ data }: { data: BottleneckPhaseData[] }) {
  const chartData = data.map((d) => ({
    label: d.label,
    avgDays: d.avgDays ?? 0,
    isBottleneck: d.isBottleneck,
    daysLabel: d.avgDays !== null ? `${d.avgDays.toFixed(1)}d` : '—',
  }))

  return (
    <ChartContainer config={chartConfig} className="w-full h-[300px]">
      <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} unit="d" />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="avgDays" radius={4} minPointSize={2}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.isBottleneck ? '#ef4444' : '#6366f1'} />
          ))}
          <LabelList dataKey="daysLabel" position="right" className="text-xs fill-slate-500" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
