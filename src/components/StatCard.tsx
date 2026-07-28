import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  color?: string
}

export function StatCard({ icon: Icon, label, value, color = 'text-slate-600' }: StatCardProps) {
  return (
    <Card className="h-full cursor-help">
      <CardContent className="p-3">
        <div className="flex items-start gap-1.5 min-h-[2.25rem]">
          <Icon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', color)} />
          <span className="text-xs font-medium text-slate-600 leading-tight">{label}</span>
        </div>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </CardContent>
    </Card>
  )
}
