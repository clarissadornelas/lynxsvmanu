import { useState } from 'react'
import { X, Plus, CalendarOff, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { DateException, TimeBlock } from './types'

interface Props {
  excecoes: DateException[]
  onChange: (excecoes: DateException[]) => void
}

export function ExceptionsEditor({ excecoes, onChange }: Props) {
  const [newDate, setNewDate] = useState('')
  const [newType, setNewType] = useState<'bloqueio' | 'abertura'>('bloqueio')

  const add = () => {
    if (!newDate || excecoes.some((e) => e.data === newDate)) return
    const exc: DateException = { data: newDate, tipo: newType }
    if (newType === 'abertura') exc.blocos = [{ inicio: '09:00', fim: '12:00' }]
    onChange([...excecoes, exc])
    setNewDate('')
  }

  const remove = (idx: number) => onChange(excecoes.filter((_, i) => i !== idx))

  const updateBloco = (excIdx: number, blocoIdx: number, field: keyof TimeBlock, value: string) => {
    const updated = [...excecoes]
    const blocos = updated[excIdx].blocos || []
    blocos[blocoIdx] = { ...blocos[blocoIdx], [field]: value }
    updated[excIdx].blocos = blocos
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Data</Label>
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-8 w-[150px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'bloqueio' | 'abertura')}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="bloqueio">Bloqueio</option>
            <option value="abertura">Abertura</option>
          </select>
        </div>
        <Button size="sm" variant="outline" onClick={add} disabled={!newDate}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {excecoes.map((exc, idx) => (
          <div
            key={idx}
            className={
              'flex items-start justify-between rounded-lg border p-2 ' +
              (exc.tipo === 'bloqueio'
                ? 'border-red-200 bg-red-50'
                : 'border-emerald-200 bg-emerald-50')
            }
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {exc.tipo === 'bloqueio' ? (
                  <CalendarOff className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <CalendarPlus className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span className="text-sm font-medium">
                  {new Date(exc.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
                <Badge
                  variant="outline"
                  className={exc.tipo === 'bloqueio' ? 'text-red-600' : 'text-emerald-600'}
                >
                  {exc.tipo === 'bloqueio' ? 'Bloqueio' : 'Abertura'}
                </Badge>
              </div>
              {exc.tipo === 'abertura' &&
                exc.blocos?.map((b, bi) => (
                  <div key={bi} className="flex items-center gap-1 pl-5">
                    <Input
                      type="time"
                      value={b.inicio}
                      onChange={(e) => updateBloco(idx, bi, 'inicio', e.target.value)}
                      className="h-6 w-[80px] text-xs"
                    />
                    <span className="text-xs">–</span>
                    <Input
                      type="time"
                      value={b.fim}
                      onChange={(e) => updateBloco(idx, bi, 'fim', e.target.value)}
                      className="h-6 w-[80px] text-xs"
                    />
                  </div>
                ))}
            </div>
            <button onClick={() => remove(idx)} className="text-slate-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
