import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DayKey, TimeBlock } from './types'
import { DAY_LABELS } from './types'
import { isValidBlock, blocksOverlap } from './utils'
import { toast } from 'sonner'

interface Props {
  semana: Record<DayKey, TimeBlock[]>
  onChange: (semana: Record<DayKey, TimeBlock[]>) => void
}

export function WeeklyWindowEditor({ semana, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, { inicio: string; fim: string }>>({})

  const getDraft = (day: string) => drafts[day] || { inicio: '09:00', fim: '12:00' }

  const addBlock = (day: DayKey) => {
    const d = getDraft(day)
    if (!isValidBlock(d.inicio, d.fim)) {
      toast.error('Início deve ser anterior ao fim')
      return
    }
    const newBlock: TimeBlock = { inicio: d.inicio, fim: d.fim }
    if (semana[day].some((b) => blocksOverlap(b, newBlock))) {
      toast.error('Horário sobrepõe um bloco existente')
      return
    }
    onChange({ ...semana, [day]: [...semana[day], newBlock] })
    setDrafts({ ...drafts, [day]: { inicio: '09:00', fim: '12:00' } })
  }

  const removeBlock = (day: DayKey, idx: number) => {
    onChange({ ...semana, [day]: semana[day].filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-2">
      {DAY_LABELS.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">{label}</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {semana[key].map((block, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
              >
                {block.inicio}–{block.fim}
                <button
                  onClick={() => removeBlock(key, idx)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="inline-flex items-center gap-1">
              <Input
                type="time"
                value={getDraft(key).inicio}
                onChange={(e) =>
                  setDrafts({ ...drafts, [key]: { ...getDraft(key), inicio: e.target.value } })
                }
                className="h-7 w-[85px] text-xs"
              />
              <span className="text-xs text-slate-400">–</span>
              <Input
                type="time"
                value={getDraft(key).fim}
                onChange={(e) =>
                  setDrafts({ ...drafts, [key]: { ...getDraft(key), fim: e.target.value } })
                }
                className="h-7 w-[85px] text-xs"
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => addBlock(key)}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
