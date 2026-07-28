import type { JanelaConfig } from './types'
import { DAY_LABELS } from './types'
import { generateSlots } from './utils'
import { Badge } from '@/components/ui/badge'

interface Props {
  config: JanelaConfig
}

export function SlotPreview({ config }: Props) {
  const hasAny = DAY_LABELS.some(
    ({ key }) => generateSlots(config.semana[key], config.duracao_min).length > 0,
  )

  return (
    <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-600">
        Preview de slots ({config.duracao_min} min)
      </p>
      {DAY_LABELS.map(({ key, label }) => {
        const slots = generateSlots(config.semana[key], config.duracao_min)
        if (slots.length === 0) return null
        return (
          <div key={key} className="space-y-1">
            <span className="text-xs font-medium text-slate-500">{label}</span>
            <div className="flex flex-wrap gap-1">
              {slots.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-mono">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )
      })}
      {!hasAny && (
        <p className="text-xs text-slate-400">
          Nenhum slot disponível. Configure as janelas semanais acima.
        </p>
      )}
    </div>
  )
}
