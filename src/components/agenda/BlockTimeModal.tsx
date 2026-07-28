import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

interface BlockTimeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedSlot: { date: Date; hour: number } | null
  tenantId: string | null
  onSaved: () => void
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)

export function BlockTimeModal({
  open,
  onOpenChange,
  selectedSlot,
  tenantId,
  onSaved,
}: BlockTimeModalProps) {
  const [titulo, setTitulo] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [startHour, setStartHour] = useState('09')
  const [endHour, setEndHour] = useState('10')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && selectedSlot) {
      setDateStr(format(selectedSlot.date, 'yyyy-MM-dd'))
      setStartHour(String(selectedSlot.hour).padStart(2, '0'))
      setEndHour(String(selectedSlot.hour + 1).padStart(2, '0'))
      setTitulo('')
    }
  }, [open, selectedSlot])

  const handleSave = async () => {
    if (!tenantId || !dateStr) return

    const startDate = new Date(`${dateStr}T${startHour}:00:00`)
    const endDate = new Date(`${dateStr}T${endHour}:00:00`)

    if (endDate <= startDate) {
      toast.error('O horário final deve ser depois do inicial.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('bloqueios_agenda').insert({
        tenant_id: tenantId,
        agenda_id: 'interna',
        titulo: titulo || null,
        inicio: startDate.toISOString(),
        fim: endDate.toISOString(),
      })

      if (error) throw error

      toast.success('Horário bloqueado com sucesso!')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao bloquear horário.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear Horário</DialogTitle>
          <DialogDescription>
            Bloqueie um horário para compromissos pessoais. O sistema não agendará entrevistas neste
            período.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="block-titulo">Título (opcional)</Label>
            <Input
              id="block-titulo"
              placeholder="Ex: Almoço, Dentista, Reunião..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-date">Data</Label>
            <Input
              id="block-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="block-start">Início</Label>
              <select
                id="block-start"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={String(h).padStart(2, '0')}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-end">Fim</Label>
              <select
                id="block-end"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={String(h).padStart(2, '0')}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          {dateStr && (
            <p className="text-sm text-slate-500 capitalize">
              {format(new Date(`${dateStr}T00:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })} das{' '}
              {startHour}:00 às {endHour}:00
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !tenantId}>
            {saving ? 'Salvando...' : 'Bloquear Horário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
