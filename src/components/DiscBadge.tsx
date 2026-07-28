import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

export function DiscBadge({ disc, className }: { disc: any; className?: string }) {
  if (!disc) return null

  // Safely extract profile name to prevent rendering objects directly
  let profileName = 'DISC'
  if (typeof disc === 'string') profileName = disc
  else if (typeof disc.perfil === 'string') profileName = disc.perfil
  else if (typeof disc.profile === 'string') profileName = disc.profile

  // Safely extract values from wherever they might be nested
  const source =
    disc?.detalhes || (typeof disc?.perfil === 'object' ? disc.perfil : null) || disc || {}
  const D = source.D ?? 0
  const I = source.I ?? 0
  const S = source.S ?? 0
  const C = source.C ?? 0

  // If there's no data at all, render nothing
  if (!D && !I && !S && !C && profileName === 'DISC') {
    return null
  }

  const factors = [
    { letter: 'D', value: D, color: '#E63946' },
    { letter: 'I', value: I, color: '#F77F00' },
    { letter: 'S', value: S, color: '#06A77D' },
    { letter: 'C', value: C, color: '#457B9D' },
  ]
  factors.sort((a, b) => b.value - a.value)
  const dominant = factors[0]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-xs border ${className || ''}`}
          style={{
            borderColor: dominant.color,
            color: dominant.color,
            backgroundColor: `${dominant.color}10`,
          }}
        >
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold mr-1"
            style={{ backgroundColor: dominant.color }}
          >
            {dominant.letter}
          </span>
          Perfil {profileName}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Análise DISC</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Dominância:</span> <span>{D}%</span>
            </div>
            <div className="flex justify-between">
              <span>Influência:</span> <span>{I}%</span>
            </div>
            <div className="flex justify-between">
              <span>Estabilidade:</span> <span>{S}%</span>
            </div>
            <div className="flex justify-between">
              <span>Conformidade:</span> <span>{C}%</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
