import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  tooltip: string
  valueClassName?: string
  titleClassName?: string
  iconClassName?: string
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  tooltip,
  valueClassName,
  titleClassName,
  iconClassName,
}: MetricCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="cursor-default">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2 min-h-[3.25rem]">
            <CardTitle className={cn('text-sm font-medium leading-tight', titleClassName)}>
              {title}
            </CardTitle>
            <Icon className={cn('w-4 h-4 shrink-0', iconClassName)} />
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold', valueClassName)}>{value}</p>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
